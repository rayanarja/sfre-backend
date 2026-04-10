const prisma = require('../../config/database');

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
  return await prisma.bus_Tracking_Log.create({
    data: {
      bus_id:     parseInt(data.bus_id),
      station_id: data.station_id ? parseInt(data.station_id) : null,
      lat:        parseFloat(data.lat),
      lng:        parseFloat(data.lng),
      speed:      data.speed ? parseInt(data.speed) : null,
    }
  });
};

module.exports = { getAllLogs, getLogsByBusId, createLog };