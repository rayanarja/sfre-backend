const prisma = require('../../config/database');

const DIRECTIONS = ['outbound', 'inbound'];

const normalizeDirection = (direction, fallback = 'outbound') =>
  DIRECTIONS.includes(direction) ? direction : fallback;

const formatRouteStation = (routeStation) => ({
  id: routeStation.id,
  station_id: routeStation.station_id,
  station_order: routeStation.station_order,
  station: routeStation.station || undefined,
});

const formatRoute = (route) => {
  const routeStations = route.route_stations || [];

  return {
    route_id: route.route_id,
    route_name: route.route_name,
    description: route.description,
    outbound: routeStations
      .filter(item => item.direction === 'outbound')
      .sort((a, b) => a.station_order - b.station_order)
      .map(formatRouteStation),
    inbound: routeStations
      .filter(item => item.direction === 'inbound')
      .sort((a, b) => a.station_order - b.station_order)
      .map(formatRouteStation),
    buses: route.buses || [],
  };
};

const routeInclude = {
  route_stations: {
    include: { station: true },
    orderBy: [{ direction: 'asc' }, { station_order: 'asc' }],
  },
  buses: true,
};

const getAllRoutes = async () => {
  const routes = await prisma.routes.findMany({
    include: routeInclude,
    orderBy: { route_id: 'asc' },
  });

  return routes.map(formatRoute);
};

const getRouteById = async (id) => {
  const route = await prisma.routes.findUnique({
    where: { route_id: parseInt(id) },
    include: routeInclude,
  });

  if (!route) throw { status: 404, message: 'Route not found' };
  return formatRoute(route);
};

const createRoute = async (data) => {
  const route = await prisma.routes.create({
    data: {
      route_name: data.route_name,
      description: data.description || null,
    },
    include: routeInclude,
  });

  return formatRoute(route);
};

const updateRoute = async (id, data) => {
  const updateData = {};
  if (data.route_name !== undefined) updateData.route_name = data.route_name;
  if (data.description !== undefined) updateData.description = data.description || null;

  const route = await prisma.routes.update({
    where: { route_id: parseInt(id) },
    data: updateData,
    include: routeInclude,
  });

  return formatRoute(route);
};

const saveRouteStations = async (id, data) => {
  const routeId = parseInt(id);
  const route = await prisma.routes.findUnique({ where: { route_id: routeId } });
  if (!route) throw { status: 404, message: 'Route not found' };

  const rows = [];
  for (const direction of DIRECTIONS) {
    const stations = Array.isArray(data[direction]) ? data[direction] : [];
    for (const item of stations) {
      rows.push({
        route_id: routeId,
        station_id: parseInt(item.station_id),
        direction: normalizeDirection(direction),
        station_order: parseInt(item.station_order),
      });
    }
  }

  const stationIds = [...new Set(rows.map(row => row.station_id))];
  const existingStations = await prisma.stations.findMany({
    where: { station_id: { in: stationIds } },
    select: { station_id: true },
  });
  const existingStationIds = new Set(existingStations.map(station => station.station_id));
  const missingStationIds = stationIds.filter(stationId => !existingStationIds.has(stationId));
  if (missingStationIds.length > 0) {
    throw { status: 400, message: `Stations not found: ${missingStationIds.join(', ')}` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.route_Stations.deleteMany({ where: { route_id: routeId } });
    if (rows.length > 0) {
      await tx.route_Stations.createMany({ data: rows });
    }
  });

  return await getRouteById(routeId);
};

const deleteRoute = async (id) => {
  const routeId = parseInt(id);

  return await prisma.$transaction(async (tx) => {
    await tx.buses.updateMany({
      where: { route_id: routeId },
      data: {
        route_id: null,
        direction: 'outbound',
        current_station_index: 1,
      },
    });
    await tx.route_Stations.deleteMany({ where: { route_id: routeId } });
    return await tx.routes.delete({ where: { route_id: routeId } });
  });
};

module.exports = {
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  saveRouteStations,
  deleteRoute,
};
