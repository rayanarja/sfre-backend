const prisma = require('../../config/database');
const { emitBusPosition } = require('../../socket');
const { getDistance } = require('../../utils/geo');

/**
 * ═══════════════════════════════════════════════
 * هيكلية الخطوط الاحترافية:
 * 
 * خط واحد = اتجاهين (ذهاب + إياب)
 * بدل ما نعتمد على اسم الخط (string matching) — نستخدم pair_route_id
 * كل خط عندو حقل pair_route_id يشير للخط المعاكس
 * 
 * مثال:
 *   Route 1: "خط الجامعة — ذهاب" (pair_route_id = 2)
 *   Route 2: "خط الجامعة — إياب" (pair_route_id = 1)
 * 
 * الباص لما يوصل آخر موقف → يتحول تلقائياً للخط المعاكس
 * ═══════════════════════════════════════════════
 */

const updateBusPosition = async (bus_id, lat, lng) => {
  const busId = parseInt(bus_id);

  const bus = await prisma.buses.findUnique({
    where: { bus_id: busId },
    include: {
      route: {
        include: {
          stations: { orderBy: { order_index: 'asc' } }
        }
      }
    }
  });

  if (!bus || !bus.route) throw { status: 404, message: 'الباص أو الخط غير موجود' };

  // حدد أقرب موقف
  let closestStation = null;
  let minDistance = Infinity;

  for (const station of bus.route.stations) {
    if (station.lat == null || station.lng == null) continue;
    const dist = getDistance(lat, lng, station.lat, station.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestStation = station;
    }
  }

  // حدّث موقع الباص
  const newDirection = bus.route.route_name.includes('ذهاب') ? 'outbound' : 'inbound';
  
  await prisma.buses.update({
    where: { bus_id: busId },
    data: {
      current_lat: lat,
      current_lng: lng,
      current_station_index: closestStation ? closestStation.order_index : bus.current_station_index,
      direction: newDirection,
      last_update: new Date(),
    },
  });

  // إذا وصل لآخر موقف ← بدّل الخط
  if (closestStation && minDistance < 200) {
    const stations = bus.route.stations;
    const lastStation = stations[stations.length - 1];
    
    if (closestStation.station_id === lastStation.station_id) {
      await switchToOppositeRoute(busId, bus.route);
    }
  }

  // ← Real-time: أبعث الموقع لكل يلي عم يتابعوا
  emitBusPosition(busId, {
    lat, lng,
    plate_number: bus.plate_number,
    current_station: closestStation?.name || null,
    current_station_index: closestStation?.order_index || 0,
    direction: newDirection,
    distance_to_station: Math.round(minDistance),
  });

  return {
    bus_id: busId,
    plate_number: bus.plate_number,
    current_station: closestStation?.name || null,
    current_station_index: closestStation?.order_index || 0,
    direction: newDirection,
    distance_to_station: Math.round(minDistance),
  };
};

/**
 * تبديل الباص للخط المعاكس
 * يبحث أولاً عن pair_route_id، وإذا ما لقى يرجع لطريقة الاسم
 */
async function switchToOppositeRoute(busId, currentRoute) {
  let oppositeRoute = null;

  // الطريقة 1: pair_route_id (الأفضل)
  if (currentRoute.pair_route_id) {
    oppositeRoute = await prisma.routes.findUnique({
      where: { route_id: currentRoute.pair_route_id },
    });
  }

  // الطريقة 2: fallback على الاسم
  if (!oppositeRoute) {
    const routeName = currentRoute.route_name;
    let oppositeName = null;
    if (routeName.includes('ذهاب')) oppositeName = routeName.replace('ذهاب', 'إياب');
    else if (routeName.includes('إياب')) oppositeName = routeName.replace('إياب', 'ذهاب');

    if (oppositeName) {
      oppositeRoute = await prisma.routes.findFirst({ where: { route_name: oppositeName } });
    }
  }

  if (oppositeRoute) {
    const newDirection = oppositeRoute.route_name.includes('ذهاب') ? 'outbound' : 'inbound';
    
    await prisma.buses.update({
      where: { bus_id: busId },
      data: {
        route_id: oppositeRoute.route_id,
        current_station_index: 0,
        direction: newDirection,
      },
    });
  }
}

// ═══════════════════════════════════════════════
// البحث عن باصات قريبة للراكب
// ═══════════════════════════════════════════════
const findBusesForPassenger = async (route_id, passenger_station_index, destination_station_index) => {
  const routeId = parseInt(route_id);
  const passengerIdx = parseInt(passenger_station_index);
  const destIdx = parseInt(destination_station_index);

  // حدد اتجاه الراكب
  const passengerDirection = destIdx > passengerIdx ? 'outbound' : 'inbound';

  // جيب كل الباصات النشطة على هالخط + الخط المعاكس
  const route = await prisma.routes.findUnique({ where: { route_id: routeId } });
  const routeIds = [routeId];
  if (route?.pair_route_id) routeIds.push(route.pair_route_id);

  const buses = await prisma.buses.findMany({
    where: {
      route_id: { in: routeIds },
      current_status: 'active',
    },
    orderBy: { current_station_index: 'asc' },
  });

  // فلتر الباصات يلي جاية باتجاه الراكب
  const relevantBuses = buses.filter(bus => {
    if (bus.current_station_index == null) return false;
    if (bus.route_id !== routeId) return false; // بس يلي على نفس الخط

    if (passengerDirection === 'outbound') {
      return bus.direction === 'outbound' && bus.current_station_index <= passengerIdx;
    } else {
      return bus.direction === 'inbound' && bus.current_station_index >= passengerIdx;
    }
  });

  // fallback: باصات بالاتجاه الثاني
  let fallbackBuses = [];
  if (relevantBuses.length === 0) {
    fallbackBuses = buses.filter(bus => {
      if (bus.current_station_index == null) return false;
      if (passengerDirection === 'outbound') {
        return bus.direction === 'inbound' && bus.current_station_index >= passengerIdx;
      } else {
        return bus.direction === 'outbound' && bus.current_station_index <= passengerIdx;
      }
    });
  }

  // جيب المواقف لحساب المسافة
  const stations = await prisma.stations.findMany({
    where: { route_id: routeId },
    orderBy: { order_index: 'asc' },
  });

  const AVG_SPEED_KMH = 25;
  const DETOUR_FACTOR = 1.3; // ← تصحيح: الطريق أطول من الخط المستقيم

  const formatBus = (bus, isFallback) => {
    const stationsDiff = Math.abs((bus.current_station_index || 0) - passengerIdx);
    let totalDistance = 0;
    const fromIdx = Math.min(bus.current_station_index || 0, passengerIdx);
    const toIdx = Math.max(bus.current_station_index || 0, passengerIdx);

    for (let i = fromIdx; i < toIdx; i++) {
      const s1 = stations.find(s => s.order_index === i);
      const s2 = stations.find(s => s.order_index === i + 1);
      if (s1 && s2 && s1.lat && s1.lng && s2.lat && s2.lng) {
        totalDistance += getDistance(s1.lat, s1.lng, s2.lat, s2.lng);
      }
    }

    totalDistance *= DETOUR_FACTOR;
    const distanceKm = totalDistance / 1000;
    const estimatedMinutes = Math.max(1, Math.round((distanceKm / AVG_SPEED_KMH) * 60));

    return {
      bus_id: bus.bus_id,
      plate_number: bus.plate_number,
      direction: bus.direction,
      direction_ar: bus.direction === 'outbound' ? 'ذهاب' : 'إياب',
      current_station_index: bus.current_station_index,
      stations_away: stationsDiff,
      distance_meters: Math.round(totalDistance),
      estimated_minutes: estimatedMinutes,
      is_ideal: !isFallback,
    };
  };

  const result = [
    ...relevantBuses.map(b => formatBus(b, false)),
    ...fallbackBuses.map(b => formatBus(b, true)),
  ];

  result.sort((a, b) => a.stations_away - b.stations_away);

  return {
    passenger_direction: passengerDirection,
    passenger_direction_ar: passengerDirection === 'outbound' ? 'ذهاب' : 'إياب',
    buses: result,
  };
};

// Buses with live coordinates for map markers
const getMapBuses = async (query = {}) => {
  const { route_id, status = 'active' } = query;
  const allowedStatuses = ['active', 'inactive', 'maintenance', 'breakdown', 'all'];

  if (!allowedStatuses.includes(status)) {
    throw { status: 400, message: 'status غير صالح' };
  }

  const routeId = route_id ? parseInt(route_id) : null;
  if (route_id && Number.isNaN(routeId)) {
    throw { status: 400, message: 'route_id غير صالح' };
  }

  const where = {
    current_lat: { not: null },
    current_lng: { not: null },
  };

  if (status !== 'all') where.current_status = status;
  if (routeId) where.route_id = routeId;

  const buses = await prisma.buses.findMany({
    where,
    select: {
      bus_id: true,
      plate_number: true,
      current_status: true,
      current_lat: true,
      current_lng: true,
      last_update: true,
      direction: true,
      current_station_index: true,
      route: {
        select: {
          route_id: true,
          route_name: true,
        },
      },
    },
    orderBy: { last_update: 'desc' },
  });

  return {
    count: buses.length,
    buses: buses.map(bus => ({
      bus_id: bus.bus_id,
      plate_number: bus.plate_number,
      lat: bus.current_lat,
      lng: bus.current_lng,
      status: bus.current_status,
      last_update: bus.last_update,
      direction: bus.direction,
      current_station_index: bus.current_station_index,
      route_id: bus.route?.route_id || null,
      route_name: bus.route?.route_name || null,
    })),
  };
};

// جلب مواقف خط معين
const getRouteStations = async (route_id) => {
  return await prisma.stations.findMany({
    where: { route_id: parseInt(route_id) },
    orderBy: { order_index: 'asc' },
  });
};

module.exports = { updateBusPosition, findBusesForPassenger, getMapBuses, getRouteStations };
