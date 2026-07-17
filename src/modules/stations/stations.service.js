const prisma = require('../../config/database');
const { getDistance } = require('../../utils/geo');
const { geocodePlace, hybridSuggestions: geoHybrid } = require('../../utils/geocoding');
const { buildHybridSuggestions } = require('./hybrid-routing.service');

const DIRECTIONS = ['outbound', 'inbound'];
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

async function getPlaceSuggestions(query) {
  const stationNames = await getStationSuggestions(query);
  try {
    return await geoHybrid(query, stationNames);
  } catch (e) {
    return stationNames.map(name => ({ name, type: 'station' }));
  }
}

async function getHybridSuggestions(userLocation, destinationCoords, options = {}) {
  const routes = await prisma.routes.findMany({
    include: {
      route_stations: {
        include: { station: true },
        orderBy: [{ direction: 'asc' }, { station_order: 'asc' }],
      },
      buses: {
        where: { current_status: 'active' },
        select: { direction: true },
      },
    },
    orderBy: { route_id: 'asc' },
  });

  return buildHybridSuggestions(routes, userLocation, destinationCoords, options);
}

const hybridPlanResponse = async (destination, passengerLat, passengerLng, destLat, destLng, metadata = {}) => {
  const passenger = { lat: Number(passengerLat), lng: Number(passengerLng) };
  const destinationCoords = { lat: Number(destLat), lng: Number(destLng) };
  const plans = await getHybridSuggestions(passenger, destinationCoords);

  return {
    plans,
    destination,
    passenger,
    destination_coords: destinationCoords,
    ...metadata,
  };
};

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

  return await hybridPlanResponse(destination, lat, lng, bestStation.lat, bestStation.lng);
}

async function planRouteV2(destination, passengerLat, passengerLng, destLat, destLng) {
  const lat = parseFloat(passengerLat);
  const lng = parseFloat(passengerLng);

  if (destLat && destLng) {
    return await hybridPlanResponse(destination, lat, lng, parseFloat(destLat), parseFloat(destLng));
  }

  const stationResult = await planRoute(destination, passengerLat, passengerLng);
  if (stationResult.plans && stationResult.plans.length > 0) return stationResult;

  try {
    const places = await geocodePlace(destination, lat, lng);
    if (places && places.length > 0) {
      const place = places[0];
      return await hybridPlanResponse(destination, lat, lng, place.lat, place.lng, {
        geocoded: true,
        geocoded_place: place.name,
        geocoded_lat: place.lat,
        geocoded_lng: place.lng,
      });
    }
  } catch (e) {
    console.error('geocoding failed:', e.message);
  }

  return { plans: [], destination };
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
  getPlaceSuggestions,
  getHybridSuggestions,
  planRouteV2,
};
