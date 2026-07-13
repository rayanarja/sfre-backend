const prisma = require('../../config/database');
const { getDistance } = require('../../utils/geo');
const { geocodePlace, hybridSuggestions: geoHybrid } = require('../../utils/geocoding');

const DIRECTIONS = ['outbound', 'inbound'];
const WALK_SPEED = 70;
const MIN_PER_STATION = 3;

const directionAr = (direction) => direction === 'outbound' ? 'ذهاب' : 'إياب';

const toStationOnRoute = (item) => ({
  ...item.station,
  route_station_id: item.id,
  route_id: item.route_id,
  direction: item.direction,
  order_index: item.station_order,
  station_order: item.station_order,
});

const groupRouteStationsByDirection = (routeStations = []) => {
  const grouped = { outbound: [], inbound: [] };
  for (const item of routeStations) {
    if (!DIRECTIONS.includes(item.direction) || !item.station) continue;
    grouped[item.direction].push(toStationOnRoute(item));
  }

  grouped.outbound.sort((a, b) => a.station_order - b.station_order);
  grouped.inbound.sort((a, b) => a.station_order - b.station_order);
  return grouped;
};

const stationInclude = {
  route_stations: {
    include: {
      route: {
        select: { route_id: true, route_name: true },
      },
    },
    orderBy: { id: 'asc' },
  },
};

// The stations endpoints expose one route for the dashboard form. Route ordering
// and additional route associations remain managed through /api/routes/:id/stations.
const formatStation = (station) => {
  const routeStation = station.route_stations?.[0];
  const { route_stations, ...data } = station;

  return {
    ...data,
    route_id: routeStation?.route_id ?? null,
    route_name: routeStation?.route?.route_name ?? null,
  };
};

const getNextStationOrder = async (tx, routeId, direction = 'outbound') => {
  const lastStation = await tx.route_Stations.findFirst({
    where: { route_id: routeId, direction },
    orderBy: { station_order: 'desc' },
    select: { station_order: true },
  });

  return (lastStation?.station_order ?? 0) + 1;
};

const ensureRouteExists = async (tx, routeId) => {
  const route = await tx.routes.findUnique({
    where: { route_id: routeId },
    select: { route_id: true },
  });
  if (!route) throw { status: 400, message: 'Route not found' };
};

const getAllStations = async () => {
  const stations = await prisma.stations.findMany({
    include: stationInclude,
    orderBy: { station_id: 'asc' },
  });
  return stations.map(formatStation);
};

const getStationById = async (id) => {
  const station = await prisma.stations.findUnique({
    where: { station_id: parseInt(id) },
    include: stationInclude,
  });
  if (!station) throw { status: 404, message: 'Station not found' };
  return formatStation(station);
};

const createStation = async (data) => {
  const routeId = Number(data.route_id);

  return await prisma.$transaction(async (tx) => {
    await ensureRouteExists(tx, routeId);
    const stationOrder = await getNextStationOrder(tx, routeId);
    const station = await tx.stations.create({
      data: {
        name: data.name,
        lat: data.lat !== undefined && data.lat !== null && data.lat !== '' ? Number(data.lat) : null,
        lng: data.lng !== undefined && data.lng !== null && data.lng !== '' ? Number(data.lng) : null,
      },
    });

    await tx.route_Stations.create({
      data: {
        route_id: routeId,
        station_id: station.station_id,
        direction: 'outbound',
        station_order: stationOrder,
      },
    });

    const stationWithRoute = await tx.stations.findUnique({
      where: { station_id: station.station_id },
      include: stationInclude,
    });
    return formatStation(stationWithRoute);
  });
};

const updateStation = async (id, data) => {
  const stationId = Number(id);
  const routeId = Number(data.route_id);
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.lat !== undefined) updateData.lat = data.lat !== null && data.lat !== '' ? Number(data.lat) : null;
  if (data.lng !== undefined) updateData.lng = data.lng !== null && data.lng !== '' ? Number(data.lng) : null;

  return await prisma.$transaction(async (tx) => {
    await ensureRouteExists(tx, routeId);

    const existingStation = await tx.stations.findUnique({
      where: { station_id: stationId },
      select: { station_id: true },
    });
    if (!existingStation) throw { status: 404, message: 'Station not found' };

    const currentRouteStation = await tx.route_Stations.findFirst({
      where: { station_id: stationId },
      orderBy: { id: 'asc' },
    });

    if (!currentRouteStation) {
      const stationOrder = await getNextStationOrder(tx, routeId);
      await tx.route_Stations.create({
        data: {
          route_id: routeId,
          station_id: stationId,
          direction: 'outbound',
          station_order: stationOrder,
        },
      });
    } else if (currentRouteStation.route_id !== routeId) {
      const stationOrder = await getNextStationOrder(tx, routeId, currentRouteStation.direction);
      await tx.route_Stations.update({
        where: { id: currentRouteStation.id },
        data: { route_id: routeId, station_order: stationOrder },
      });
    }

    const station = await tx.stations.update({
      where: { station_id: stationId },
      data: updateData,
      include: stationInclude,
    });

    return formatStation(station);
  });
};

const deleteStation = async (id) => {
  return await prisma.stations.delete({ where: { station_id: parseInt(id) } });
};

const searchByDestination = async (destination) => {
  return await prisma.route_Stations.findMany({
    where: { station: { name: { contains: destination } } },
    include: {
      station: true,
      route: { include: { buses: true } },
    },
    orderBy: [{ route_id: 'asc' }, { direction: 'asc' }, { station_order: 'asc' }],
  });
};

const smartSearch = async (destination, passenger_lat, passenger_lng) => {
  const matchedRouteStations = await prisma.route_Stations.findMany({
    where: { station: { name: { contains: destination } } },
    include: {
      station: true,
      route: {
        include: {
          route_stations: {
            include: { station: true },
            orderBy: { station_order: 'asc' },
          },
          buses: { where: { current_status: 'active' } },
        },
      },
    },
  });

  const resultsMap = {};
  for (const match of matchedRouteStations) {
    if (!match.route || !match.station) continue;
    const key = `${match.route_id}-${match.direction}`;
    if (resultsMap[key]) continue;

    const grouped = groupRouteStationsByDirection(match.route.route_stations);
    const stations = grouped[match.direction];
    const activeBuses = match.route.buses.filter(bus => bus.direction === match.direction);

    let closestStation = null;
    let minDist = Infinity;
    if (passenger_lat && passenger_lng) {
      for (const station of stations) {
        if (station.lat == null || station.lng == null) continue;
        const dist = getDistance(parseFloat(passenger_lat), parseFloat(passenger_lng), station.lat, station.lng);
        if (dist < minDist) {
          minDist = dist;
          closestStation = station;
        }
      }
    }

    const busesInfo = activeBuses.map(bus => {
      const stationsAway = closestStation && bus.current_station_index != null
        ? Math.max(0, closestStation.station_order - bus.current_station_index)
        : null;

      return {
        bus_id: bus.bus_id,
        plate_number: bus.plate_number,
        direction: bus.direction,
        direction_ar: directionAr(bus.direction),
        stations_away: stationsAway,
        estimated_minutes: stationsAway == null ? null : Math.max(1, stationsAway * MIN_PER_STATION),
        is_ideal: stationsAway != null && stationsAway >= 0,
      };
    }).sort((a, b) => (a.estimated_minutes || 999) - (b.estimated_minutes || 999));

    resultsMap[key] = {
      route_id: match.route.route_id,
      route_name: match.route.route_name,
      direction: match.direction,
      direction_ar: directionAr(match.direction),
      matched_station: match.station.name,
      matched_station_index: match.station_order,
      stations_count: stations.length,
      closest_station: closestStation ? {
        station_id: closestStation.station_id,
        name: closestStation.name,
        station_order: closestStation.station_order,
        distance_meters: Math.round(minDist),
      } : null,
      passenger_direction: match.direction,
      passenger_direction_ar: directionAr(match.direction),
      active_buses: busesInfo,
      active_buses_count: activeBuses.length,
      best_eta_minutes: busesInfo.length > 0 ? busesInfo[0].estimated_minutes : null,
    };
  }

  return Object.values(resultsMap).sort((a, b) => (a.best_eta_minutes || 999) - (b.best_eta_minutes || 999));
};

async function getStationSuggestions(query) {
  const stations = await prisma.stations.findMany({
    where: { name: { contains: query } },
    select: { name: true },
    distinct: ['name'],
    take: 8,
  });
  return stations.map(station => station.name);
}

async function hybridSuggestions(query) {
  const stationNames = await getStationSuggestions(query);
  try {
    return await geoHybrid(query, stationNames);
  } catch (e) {
    return stationNames.map(name => ({ name, type: 'station' }));
  }
}

async function planRoute(destination, passengerLat, passengerLng) {
  const lat = parseFloat(passengerLat);
  const lng = parseFloat(passengerLng);

  const matchedStations = await prisma.stations.findMany({
    where: { name: { contains: destination } },
  });

  if (matchedStations.length === 0) return { plans: [], destination };

  let bestStation = matchedStations[0];
  let bestDist = Infinity;
  for (const station of matchedStations) {
    if (station.lat == null || station.lng == null) continue;
    const dist = getDistance(lat, lng, station.lat, station.lng);
    if (dist < bestDist) {
      bestDist = dist;
      bestStation = station;
    }
  }

  if (bestStation.lat == null || bestStation.lng == null) {
    return { plans: [], destination, passenger: { lat, lng } };
  }

  return await _planRouteByCoords(destination, lat, lng, bestStation.lat, bestStation.lng);
}

async function planRouteV2(destination, passengerLat, passengerLng, destLat, destLng) {
  const lat = parseFloat(passengerLat);
  const lng = parseFloat(passengerLng);

  if (destLat && destLng) {
    return await _planRouteByCoords(destination, lat, lng, parseFloat(destLat), parseFloat(destLng));
  }

  const stationResult = await planRoute(destination, passengerLat, passengerLng);
  if (stationResult.plans && stationResult.plans.length > 0) return stationResult;

  try {
    const places = await geocodePlace(destination, lat, lng);
    if (places && places.length > 0) {
      const place = places[0];
      const result = await _planRouteByCoords(destination, lat, lng, place.lat, place.lng, { maxWalkFromEnd: 3000 });
      result.geocoded = true;
      result.geocoded_place = place.name;
      result.geocoded_lat = place.lat;
      result.geocoded_lng = place.lng;
      return result;
    }
  } catch (e) {
    console.error('geocoding failed:', e.message);
  }

  return { plans: [], destination };
}

async function _planRouteByCoords(destName, passengerLat, passengerLng, destLat, destLng, options = {}) {
  const maxWalkToStart = 2000;
  const maxWalkFromEnd = options.maxWalkFromEnd || 1500;

  const routes = await prisma.routes.findMany({
    include: {
      route_stations: {
        include: { station: true },
        orderBy: { station_order: 'asc' },
      },
      buses: { where: { current_status: 'active' } },
    },
  });

  const candidates = [];
  for (const route of routes) {
    const grouped = groupRouteStationsByDirection(route.route_stations);

    for (const direction of DIRECTIONS) {
      const stations = grouped[direction];
      if (stations.length < 2) continue;

      const boardingOptions = stations
        .filter(station => station.lat != null && station.lng != null)
        .map(station => ({ station, distance: getDistance(passengerLat, passengerLng, station.lat, station.lng) }))
        .filter(item => item.distance <= maxWalkToStart)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

      const alightingOptions = stations
        .filter(station => station.lat != null && station.lng != null)
        .map(station => ({ station, distance: getDistance(destLat, destLng, station.lat, station.lng) }))
        .filter(item => item.distance <= maxWalkFromEnd)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3);

      for (const boarding of boardingOptions) {
        for (const alighting of alightingOptions) {
          const stationCount = alighting.station.station_order - boarding.station.station_order;
          if (stationCount <= 0) continue;

          const busMin = stationCount * MIN_PER_STATION;
          const walkToStart = Math.round(boarding.distance / WALK_SPEED);
          const walkFromEnd = Math.round(alighting.distance / WALK_SPEED);
          const totalMin = busMin + walkToStart + walkFromEnd;
          const totalWalking = Math.round(boarding.distance + alighting.distance);

          candidates.push({
            type: 'direct',
            type_ar: 'رحلة مباشرة',
            direction,
            direction_ar: directionAr(direction),
            total_minutes: totalMin,
            total_walking: totalWalking,
            walk_to_station: Math.round(boarding.distance),
            walk_from_end: Math.round(alighting.distance),
            walk_from_end_minutes: walkFromEnd,
            from_station_lat: boarding.station.lat,
            from_station_lng: boarding.station.lng,
            dest_station_lat: alighting.station.lat,
            dest_station_lng: alighting.station.lng,
            destination_lat: destLat,
            destination_lng: destLng,
            legs: [{
              action: 'bus',
              route_id: route.route_id,
              route_name: route.route_name,
              direction,
              from: boarding.station.name,
              to: alighting.station.name,
              from_lat: boarding.station.lat,
              from_lng: boarding.station.lng,
              to_lat: alighting.station.lat,
              to_lng: alighting.station.lng,
              stations: stationCount,
              minutes: busMin,
              buses: route.buses.filter(bus => bus.direction === direction).length,
            }],
          });
        }
      }
    }
  }

  if (candidates.length === 0) {
    return { plans: [], destination: destName, passenger: { lat: passengerLat, lng: passengerLng } };
  }

  const fastest = [...candidates].sort((a, b) => a.total_minutes - b.total_minutes)[0];
  const comfort = [...candidates].sort((a, b) => a.total_walking - b.total_walking)[0];
  fastest.tag = 'fastest';
  fastest.tag_ar = 'الأسرع';
  comfort.tag = 'comfort';
  comfort.tag_ar = 'الأريح';

  const plans = [fastest];
  if (JSON.stringify(fastest.legs) !== JSON.stringify(comfort.legs)) plans.push(comfort);

  return {
    plans,
    destination: destName,
    passenger: { lat: passengerLat, lng: passengerLng },
  };
}

module.exports = {
  getAllStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
  searchByDestination,
  smartSearch,
  planRoute,
  getStationSuggestions,
  hybridSuggestions,
  planRouteV2,
};
