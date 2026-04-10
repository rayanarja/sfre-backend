const trackingService = require('./tracking.service');

const getAll = async (req, res, next) => {
  try {
    const logs = await trackingService.getAllLogs();
    res.json(logs);
  } catch (err) { next(err); }
};

const getByBus = async (req, res, next) => {
  try {
    const logs = await trackingService.getLogsByBusId(req.params.bus_id);
    res.json(logs);
  } catch (err) { next(err); }
};
const create = async (req, res, next) => {
  try {
    const log = await trackingService.createLog(req.body);
    res.status(201).json(log);
  } catch (err) { next(err); }
};

module.exports = { getAll, getByBus, create };