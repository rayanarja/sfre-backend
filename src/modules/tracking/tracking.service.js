const prisma = require('../../config/database');
const busTrackerService = require('../bus-tracker/bus-tracker.service');

const getAllLogs = async () => {
  return await prisma.bus_Tracking_Log.findMany({
    include: { bus: true, station: true },
    orderBy: { timestamp: 'desc' }
  });
};

const getLogsByBusId = async (bus_id) => {
  return await prisma.bus_Tracking_Log.findMany({
    where: { bus_id: parseInt(bus_id) },
    include: { station: true },
    orderBy: { timestamp: 'desc' }
  });
};

const createLog = async (data) => {
  const busId = parseInt(data.bus_id);
  const latitude = Number(data.lat);
  const longitude = Number(data.lng);

  // Keep the legacy tracking endpoint compatible with the live map. The map
  // reads Buses.current_lat/current_lng, while this endpoint historically only
  // appended a tracking log and left the live bus record stale.
  await busTrackerService.updateBusPosition(busId, latitude, longitude);

  return await prisma.bus_Tracking_Log.create({
    data: {
      bus_id:     busId,
      station_id: data.station_id ? parseInt(data.station_id) : null,
      lat:        latitude,
      lng:        longitude,
      speed:      data.speed ? parseInt(data.speed) : null,
    }
  });
};

module.exports = { getAllLogs, getLogsByBusId, createLog };
