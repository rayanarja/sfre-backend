const prisma = require('../../config/database');
const { emitBusPosition } = require('../../socket');
const { getDistance } = require('../../utils/geo');

const DIRECTIONS = ['outbound', 'inbound'];
const AVG_SPEED_KMH = 25;
const DETOUR_FACTOR = 1.3;

const normalizeDirection = (direction, fallback = 'outbound') =>
  DIRECTIONS.includes(direction) ? direction : fallback;

const oppositeDirection = (direction) =>
  direction === 'outbound' ? 'inbound' : 'outbound';

const directionAr = (direction) =>
  direction === 'outbound' ? 'ذهاب' : 'إياب';

const toStationOnRoute = (routeStation) => ({
  ...routeStation.station,
  route_station_id: routeStation.id,
  route_id: routeStation.route_id,
  direction: routeStation.direction,
  order_index: routeStation.station_order,
  station_order: routeStation.station_order,
});

const updateBusPosition = async (bus_id, lat, lng) => {
  const busId = parseInt(bus_id);

  const bus = await prisma.buses.findUnique({
    where: { bus_id: busId },
    include: {
      route: {
        include: {
          route_stations: {
            include: { station: true },
            orderBy: { station_order: 'asc' },
          },
        },
      },
    },
  });

  if (!bus || !bus.route) throw { status: 404, message: 'Bus or route not found' };

  const currentDirection = normalizeDirection(bus.direction);
  const routeStations = bus.route.route_stations
    .filter(item => item.direction === currentDirection && item.station)
    .map(toStationOnRoute);

  let closestStation = null;
  let minDistance = Infinity;

  for (const station of routeStations) {
    if (station.lat == null || station.lng == null) continue;
    const dist = getDistance(lat, lng, station.lat, station.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestStation = station;
    }
  }

  let finalDirection = currentDirection;
  let finalStationIndex = closestStation ? closestStation.station_order : bus.current_station_index;

  await prisma.buses.update({
    where: { bus_id: busId },
    data: {
      current_lat: lat,
      current_lng: lng,
      current_station_index: finalStationIndex,
      direction: currentDirection,
      last_update: new Date(),
    },
  });

  if (closestStation && minDistance < 200 && routeStations.length > 0) {
    const lastStation = routeStations[routeStations.length - 1];
    if (closestStation.station_id === lastStation.station_id) {
      finalDirection = await switchToOppositeDirection(busId, bus.route_id, currentDirection);
      if (finalDirection !== currentDirection) finalStationIndex = 1;
    }
  }

  const payload = {
    lat,
    lng,
    plate_number: bus.plate_number,
    current_station: closestStation?.name || null,
    current_station_index: finalStationIndex || 1,
    direction: finalDirection,
    distance_to_station: Number.isFinite(minDistance) ? Math.round(minDistance) : null,
  };

  emitBusPosition(busId, payload);

  return {
    bus_id: busId,
    plate_number: bus.plate_number,
    current_station: payload.current_station,
    current_station_index: payload.current_station_index,
    direction: payload.direction,
    distance_to_station: payload.distance_to_station,
  };
};

async function switchToOppositeDirection(busId, routeId, currentDirection) {
  const newDirection = oppositeDirection(currentDirection);
  const stationsCount = await prisma.route_Stations.count({
    where: { route_id: routeId, direction: newDirection },
  });

  if (stationsCount === 0) return currentDirection;

  await prisma.buses.update({
    where: { bus_id: busId },
    data: {
      direction: newDirection,
      current_station_index: 1,
    },
  });

  return newDirection;
}

const findBusesForPassenger = async (route_id, passenger_station_index, destination_station_index, direction) => {
  const routeId = parseInt(route_id);
  const passengerIdx = parseInt(passenger_station_index);
  const destIdx = parseInt(destination_station_index);

  if (Number.isNaN(routeId) || Number.isNaN(passengerIdx) || Number.isNaN(destIdx)) {
    throw { status: 400, message: 'route_id, passenger_station_index and destination_station_index are required' };
  }

  const passengerDirection = direction
    ? normalizeDirection(direction)
    : destIdx > passengerIdx ? 'outbound' : 'inbound';

  const buses = await prisma.buses.findMany({
    where: {
      route_id: routeId,
      current_status: 'active',
    },
    orderBy: { current_station_index: 'asc' },
  });

  const relevantBuses = buses.filter(bus => {
    if (bus.current_station_index == null) return false;
    return bus.direction === passengerDirection && bus.current_station_index <= passengerIdx;
  });

  let fallbackBuses = [];
  if (relevantBuses.length === 0) {
    fallbackBuses = buses.filter(bus => {
      if (bus.current_station_index == null) return false;
      return bus.direction !== passengerDirection;
    });
  }

  const stations = await getRouteStations(routeId, passengerDirection);

  const formatBus = (bus, isFallback) => {
    const stationsDiff = Math.abs((bus.current_station_index || 1) - passengerIdx);
    let totalDistance = 0;
    const fromIdx = Math.min(bus.current_station_index || 1, passengerIdx);
    const toIdx = Math.max(bus.current_station_index || 1, passengerIdx);

    for (let i = fromIdx; i < toIdx; i++) {
      const s1 = stations.find(station => station.station_order === i);
      const s2 = stations.find(station => station.station_order === i + 1);
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
      direction_ar: directionAr(bus.direction),
      current_station_index: bus.current_station_index,
      stations_away: stationsDiff,
      distance_meters: Math.round(totalDistance),
      estimated_minutes: estimatedMinutes,
      is_ideal: !isFallback,
    };
  };

  const result = [
    ...relevantBuses.map(bus => formatBus(bus, false)),
    ...fallbackBuses.map(bus => formatBus(bus, true)),
  ].sort((a, b) => a.stations_away - b.stations_away);

  return {
    passenger_direction: passengerDirection,
    passenger_direction_ar: directionAr(passengerDirection),
    buses: result,
  };
};

const getMapBuses = async (query = {}) => {
  const { route_id, direction, status = 'active' } = query;
  const allowedStatuses = ['active', 'inactive', 'maintenance', 'breakdown', 'all'];

  if (!allowedStatuses.includes(status)) {
    throw { status: 400, message: 'Invalid status' };
  }

  const routeId = route_id ? parseInt(route_id) : null;
  if (route_id && Number.isNaN(routeId)) {
    throw { status: 400, message: 'Invalid route_id' };
  }

  const where = {
    current_lat: { not: null },
    current_lng: { not: null },
  };

  if (status !== 'all') where.current_status = status;
  if (routeId) where.route_id = routeId;
  if (direction) where.direction = normalizeDirection(direction);

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
      direction_ar: directionAr(bus.direction),
      current_station_index: bus.current_station_index,
      route_id: bus.route?.route_id || null,
      route_name: bus.route?.route_name || null,
    })),
  };
};

const getRouteStations = async (route_id, direction = 'outbound') => {
  const routeStations = await prisma.route_Stations.findMany({
    where: {
      route_id: parseInt(route_id),
      direction: normalizeDirection(direction),
    },
    include: { station: true },
    orderBy: { station_order: 'asc' },
  });

  return routeStations.map(toStationOnRoute);
};

module.exports = { updateBusPosition, findBusesForPassenger, getMapBuses, getRouteStations };
