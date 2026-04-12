const prisma = require('../../../config/database');
const { getDistance } = require('../../../utils/geo');
const { geocodePlace, hybridSuggestions: geoHybrid } = require('../../../utils/geocoding');

// ═══════════════════════════════════════
// 1. الدوال الأساسية (CRUD)
// ═══════════════════════════════════════

const getAll = async (req, res, next) => {
  try {
    const stations = await prisma.stations.findMany({ include: { route: true } });
    res.json(stations);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const station = await prisma.stations.findUnique({
      where: { station_id: parseInt(req.params.id) },
      include: { route: true }
    });
    if (!station) return res.status(404).json({ message: 'المحطة غير موجودة' });
    res.json(station);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { name, route_id, lat, lng, order_index } = req.body;
    const station = await prisma.stations.create({
      data: {  // ✅ أضفنا data: هنا
        name,
        route_id: parseInt(route_id),
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        order_index: order_index ? parseInt(order_index) : null,
      },
      include: { route: true }
    });
    res.status(201).json(station);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { name, route_id, lat, lng, order_index } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (route_id !== undefined) updateData.route_id = parseInt(route_id);
    if (lat !== undefined) updateData.lat = lat ? parseFloat(lat) : null;
    if (lng !== undefined) updateData.lng = lng ? parseFloat(lng) : null;
    if (order_index !== undefined) updateData.order_index = order_index ? parseInt(order_index) : null;
    
    const station = await prisma.stations.update({
      where: { station_id: parseInt(req.params.id) },
      data: updateData,  // ✅ أضفنا data: هنا
      include: { route: true },
    });
    res.json(station);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await prisma.stations.delete({ where: { station_id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════
// 2. البحث والاقتراحات
// ═══════════════════════════════════════

const searchDestination = async (req, res, next) => {
  try {
    const { destination } = req.query;
    const stations = await prisma.stations.findMany({
      where: { name: { contains: destination } },
      include: { route: { include: { buses: true, stations: true } } }
    });
    res.json(stations);
  } catch (err) { next(err); }
};

const smartSearch = async (req, res, next) => {
  try {
    const { destination, passenger_lat, passenger_lng } = req.query;
    const matchedStations = await prisma.stations.findMany({
      where: { name: { contains: destination } },
      include: {
        route: {
          include: {
            stations: { orderBy: { order_index: 'asc' } },
            buses: { where: { current_status: 'active' } },
          },
        },
      },
    });

    const routesMap = {};
    for (const station of matchedStations) {
      if (!station.route) continue;
      const routeId = station.route.route_id;
      if (routesMap[routeId]) continue;

      const route = station.route;
      const allStations = route.stations;
      const activeBuses = route.buses;

      let closestStation = null, minDist = Infinity;
      if (passenger_lat && passenger_lng) {
        for (const s of allStations) {
          if (s.lat && s.lng) {
            const dist = getDistance(parseFloat(passenger_lat), parseFloat(passenger_lng), s.lat, s.lng);
            if (dist < minDist) { minDist = dist; closestStation = s; }
          }
        }
      }

      let passengerDirection = null;
      if (closestStation) {
        passengerDirection = station.order_index > closestStation.order_index ? 'outbound' : 'inbound';
      }

      const busesInfo = activeBuses.map(bus => {
        const stationsDiff = closestStation ? Math.abs((bus.current_station_index || 0) - closestStation.order_index) : null;
        let totalDistance = 0;
        if (closestStation && bus.current_station_index != null) {
          const fromIdx = Math.min(bus.current_station_index, closestStation.order_index);
          const toIdx = Math.max(bus.current_station_index, closestStation.order_index);
          for (let i = fromIdx; i < toIdx; i++) {
            const s1 = allStations.find(s => s.order_index === i);
            const s2 = allStations.find(s => s.order_index === i + 1);
            if (s1 && s2 && s1.lat && s1.lng && s2.lat && s2.lng) {
              totalDistance += getDistance(s1.lat, s1.lng, s2.lat, s2.lng);
            }
          }
        }

        const distanceKm = totalDistance / 1000;
        const estimatedMinutes = distanceKm > 0 ? Math.max(1, Math.round((distanceKm / 25) * 60)) : null;
        let isIdeal = false;
        if (passengerDirection && bus.direction && closestStation) {
          isIdeal = passengerDirection === 'outbound' 
            ? bus.direction === 'outbound' && (bus.current_station_index || 0) <= closestStation.order_index
            : bus.direction === 'inbound' && (bus.current_station_index || 0) >= closestStation.order_index;
        }

        return { bus_id: bus.bus_id, plate_number: bus.plate_number, direction: bus.direction, direction_ar: bus.direction === 'outbound' ? 'ذهاب' : 'إياب', stations_away: stationsDiff, distance_meters: Math.round(totalDistance), estimated_minutes: estimatedMinutes, is_ideal: isIdeal };
      });

      busesInfo.sort((a, b) => {
        if (a.is_ideal && !b.is_ideal) return -1;
        if (!a.is_ideal && b.is_ideal) return 1;
        return (a.stations_away || 999) - (b.stations_away || 999);
      });

      routesMap[routeId] = {
        route_id: route.route_id, route_name: route.route_name, matched_station: station.name, matched_station_index: station.order_index, stations_count: allStations.length,
        closest_station: closestStation ? { name: closestStation.name, order_index: closestStation.order_index, distance_meters: Math.round(minDist) } : null,
        passenger_direction: passengerDirection, passenger_direction_ar: passengerDirection === 'outbound' ? 'ذهاب' : passengerDirection === 'inbound' ? 'إياب' : null,
        active_buses: busesInfo, active_buses_count: activeBuses.length, best_eta_minutes: busesInfo.length > 0 ? busesInfo[0].estimated_minutes : null,
      };
    }

    const results = Object.values(routesMap);
    results.sort((a, b) => (a.best_eta_minutes || 999) - (b.best_eta_minutes || 999));
    res.json(results);
  } catch (err) { next(err); }
};

const suggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    
    const stations = await prisma.stations.findMany({
      where: { name: { contains: q.trim() } },
      select: { name: true, station_id: true, lat: true, lng: true },
      distinct: ['name'],
      take: 15,
      orderBy: { name: 'asc' }
    });
    
    res.json(stations.map(s => ({ name: s.name, type: 'station', station_id: s.station_id, lat: s.lat, lng: s.lng })));
  } catch (err) { next(err); }
};

const hybridSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    
    const stationNames = await prisma.stations.findMany({
      where: { name: { contains: q.trim() } },
      select: { name: true },
      distinct: ['name'],
      take: 15,
    });
    const names = stationNames.map(s => s.name);
    
    try {
      const geoResults = await geoHybrid(q, names);
      res.json(Array.isArray(geoResults) ? geoResults : names.map(n => ({ name: n, type: 'station' })));
    } catch (e) {
      console.warn('[hybridSuggestions] Geo fallback:', e.message);
      res.json(names.map(n => ({ name: n, type: 'station' })));
    }
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════
// 3. تخطيط المسار
// ═══════════════════════════════════════

const planRoute = async (req, res, next) => {
  try {
    const { destination, lat, lng } = req.query;
    const result = await _planRouteByCoords(destination, parseFloat(lat), parseFloat(lng), null, null, true);
    res.json(result);
  } catch (err) { next(err); }
};

const planRouteV2 = async (req, res, next) => {
  try {
    const { destination, lat, lng, dest_lat, dest_lng } = req.query;
    const result = await _planRouteByCoords(
      destination, 
      parseFloat(lat), 
      parseFloat(lng), 
      dest_lat ? parseFloat(dest_lat) : null, 
      dest_lng ? parseFloat(dest_lng) : null,
      false
    );
    res.json(result);
  } catch (err) { next(err); }
};

// ═══════════════════════════════════════
// 4. الدالة الداخلية لتخطيط المسار
// ═══════════════════════════════════════

async function _planRouteByCoords(destName, passengerLat, passengerLng, destLat, destLng, isLegacy) {
  const MAX_WALK = 2000, TRANSFER_RADIUS = 800, WALK_SPEED = 70, MIN_PER_STATION = 3, MAX_MINUTES = 90;
  const E_BUS = 1, E_WALK_START = 3, E_WALK_TRANSFER = 5, E_WALK_END = 2, E_TRANSFER_FIX = 3;

  const allRoutes = await prisma.routes.findMany({
    include: { stations: { orderBy: { order_index: 'asc' } }, buses: { where: { current_status: 'active' } } }
  });

  const routeAnalysis = allRoutes.map(route => {
    let nearestToPassenger = null, distToPassenger = Infinity, nearestToDest = null, distToDest = Infinity;
    for (const s of route.stations) {
      if (s.lat == null || s.lng == null) continue;
      const dp = getDistance(passengerLat, passengerLng, s.lat, s.lng);
      if (dp < distToPassenger) { distToPassenger = dp; nearestToPassenger = s; }
      const dd = destLat && destLng ? getDistance(destLat, destLng, s.lat, s.lng) : Infinity;
      if (dd < distToDest) { distToDest = dd; nearestToDest = s; }
    }
    return { route, nearestToPassenger, distToPassenger, nearestToDest, distToDest };
  }).filter(r => r.nearestToPassenger && r.distToPassenger <= MAX_WALK);

  const directPlans = routeAnalysis.map(ra => {
    if (!ra.nearestToDest || ra.distToDest > MAX_WALK) return null;
    const stCount = Math.abs((ra.nearestToDest.order_index || 0) - (ra.nearestToPassenger.order_index || 0));
    if (stCount === 0 || ra.nearestToPassenger.station_id === ra.nearestToDest.station_id) return null;
    const busMin = Math.min(60, Math.max(1, stCount * MIN_PER_STATION));
    const wStart = Math.round(ra.distToPassenger / WALK_SPEED), wEnd = Math.round(ra.distToDest / WALK_SPEED);
    const totalMin = busMin + wStart + wEnd;
    if (totalMin > MAX_MINUTES) return null;
    const eta = _calcBusEta(ra.route.buses, ra.nearestToPassenger.order_index, MIN_PER_STATION);
    return {
      type: 'direct', type_ar: 'رحلة مباشرة', total_minutes: totalMin, effort_score: busMin * E_BUS + wStart * E_WALK_START + wEnd * E_WALK_END,
      walk_to_station: Math.round(ra.distToPassenger), walk_from_end: Math.round(ra.distToDest), walk_from_end_minutes: wEnd,
      from_station_lat: ra.nearestToPassenger.lat, from_station_lng: ra.nearestToPassenger.lng,
      dest_station_lat: ra.nearestToDest.lat, dest_station_lng: ra.nearestToDest.lng,
      legs: [{ action: 'bus', route_name: ra.route.route_name, from: ra.nearestToPassenger.name, to: ra.nearestToDest.name, from_lat: ra.nearestToPassenger.lat, from_lng: ra.nearestToPassenger.lng, to_lat: ra.nearestToDest.lat, to_lng: ra.nearestToDest.lng, stations: stCount, minutes: busMin, buses: ra.route.buses.length, bus_eta: eta },
             ...(ra.distToDest > 100 ? [{ action: 'walk', from: ra.nearestToDest.name, to: destName, from_lat: ra.nearestToDest.lat, from_lng: ra.nearestToDest.lng, to_lat: destLat, to_lng: destLng, meters: Math.round(ra.distToDest), minutes: wEnd }] : [])]
    };
  }).filter(Boolean);

  const transferPlans = [], bestTransfers = {};
  const pStops = routeAnalysis.flatMap(ra => ra.route.stations.filter(s => s.lat && s.lng && getDistance(passengerLat, passengerLng, s.lat, s.lng) <= MAX_WALK).map(s => ({ route: ra.route, station: s, distance: getDistance(passengerLat, passengerLng, s.lat, s.lng) })));
  const dStops = destLat && destLng ? routeAnalysis.flatMap(ra => ra.route.stations.filter(s => s.lat && s.lng && getDistance(destLat, destLng, s.lat, s.lng) <= MAX_WALK).map(s => ({ route: ra.route, station: s, distance: getDistance(destLat, destLng, s.lat, s.lng) }))) : [];

  for (const o of pStops) {
    for (const d of dStops) {
      if (o.route.route_id === d.route.route_id) continue;
      const key = `${o.route.route_id}-${d.route.route_id}`;
      for (const s1 of o.route.stations) {
        if (!s1.lat || !s1.lng || s1.order_index <= o.station.order_index) continue;
        for (const s2 of d.route.stations) {
          if (!s2.lat || !s2.lng || s2.order_index >= d.station.order_index) continue;
          const tDist = getDistance(s1.lat, s1.lng, s2.lat, s2.lng);
          if (tDist > TRANSFER_RADIUS) continue;
          const st1 = s1.order_index - o.station.order_index, st2 = d.station.order_index - s2.order_index;
          if (st1 <= 0 || st2 <= 0) continue;
          const b1 = Math.min(60, st1 * MIN_PER_STATION), b2 = Math.min(60, st2 * MIN_PER_STATION);
          const wS = Math.round(o.distance / WALK_SPEED), wT = Math.max(1, Math.round(tDist / WALK_SPEED)), wE = Math.round(d.distance / WALK_SPEED);
          const total = b1 + b2 + wS + wT + wE;
          if (total > MAX_MINUTES) continue;
          const score = (b1 + b2) * E_BUS + wS * E_WALK_START + wT * E_WALK_TRANSFER + wE * E_WALK_END + E_TRANSFER_FIX;
          if (!bestTransfers[key] || score < bestTransfers[key].effort_score) {
            bestTransfers[key] = {
              type: 'transfer', type_ar: 'رحلة بتحويل', total_minutes: total, effort_score: score, walk_to_station: Math.round(o.distance), walk_from_end: Math.round(d.distance), walk_from_end_minutes: wE,
              from_station_lat: o.station.lat, from_station_lng: o.station.lng, dest_station_lat: d.station.lat, dest_station_lng: d.station.lng,
              legs: [
                { action: 'bus', route_name: o.route.route_name, from: o.station.name, to: s1.name, from_lat: o.station.lat, from_lng: o.station.lng, to_lat: s1.lat, to_lng: s1.lng, stations: st1, minutes: b1, buses: o.route.buses.length, bus_eta: _calcBusEta(o.route.buses, o.station.order_index, MIN_PER_STATION) },
                { action: 'walk', from: s1.name, to: s2.name, from_lat: s1.lat, from_lng: s1.lng, to_lat: s2.lat, to_lng: s2.lng, meters: Math.round(tDist), minutes: wT },
                { action: 'bus', route_name: d.route.route_name, from: s2.name, to: d.station.name, from_lat: s2.lat, from_lng: s2.lng, to_lat: d.station.lat, to_lng: d.station.lng, stations: st2, minutes: b2, buses: d.route.buses.length, bus_eta: _calcBusEta(d.route.buses, s2.order_index, MIN_PER_STATION) },
                ...(d.distance > 100 ? [{ action: 'walk', from: d.station.name, to: destName, from_lat: d.station.lat, from_lng: d.station.lng, to_lat: destLat, to_lng: destLng, meters: Math.round(d.distance), minutes: wE }] : [])
              ]
            };
          }
        }
      }
    }
  }
  transferPlans.push(...Object.values(bestTransfers));

  const candidates = [...directPlans, ...transferPlans];
  if (candidates.length === 0) return { plans: [], destination: destName, passenger: { lat: passengerLat, lng: passengerLng } };

  for (const p of candidates) p.total_walking = (p.walk_to_station || 0) + (p.legs || []).filter(l => l.action === 'walk').reduce((s, l) => s + (l.meters || 0), 0);

  const fastest = [...candidates].sort((a, b) => a.total_minutes - b.total_minutes || a.total_walking - b.total_walking)[0];
  fastest.tag = 'fastest'; fastest.tag_ar = 'الأفضل كوقت';

  const comfort = [...candidates].sort((a, b) => a.total_walking - b.total_walking || a.total_minutes - b.total_minutes)[0];
  comfort.tag = 'comfort'; comfort.tag_ar = 'الأفضل كراحة';

  const unique = JSON.stringify(fastest.legs?.map(l => l.route_name || 'walk').join('|')) !== JSON.stringify(comfort.legs?.map(l => l.route_name || 'walk').join('|'));
  const plans = unique ? [fastest, comfort] : [fastest];

  return { plans, destination: destName, passenger: { lat: passengerLat, lng: passengerLng } };
}

function _calcBusEta(buses, stationIndex, minPerStation) {
  if (!buses?.length) return null;
  let closest = Infinity;
  for (const bus of buses) { const diff = Math.abs((bus.current_station_index || 0) - (stationIndex || 0)); if (diff < closest) closest = diff; }
  return closest * minPerStation;
}

// ═══════════════════════════════════════
// ✅ التصدير
// ═══════════════════════════════════════
module.exports = {
  getAll,
  getOne,
  create,
  update,
  remove,
  searchDestination,
  suggestions,
  hybridSuggestions,
  smartSearch,
  planRoute,
  planRouteV2,
};