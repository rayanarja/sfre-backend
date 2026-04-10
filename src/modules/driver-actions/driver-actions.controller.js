const driverActionsService = require('./driver-actions.service');

const updateBusStatus = async (req, res, next) => {
  try {
    const result = await driverActionsService.updateBusStatus(req.params.bus_id, req.body.status, req.body.driver_id);
    res.json(result);
  } catch (err) { next(err); }
};

const sendDelayAlert = async (req, res, next) => {
  try { res.json(await driverActionsService.sendDelayAlert(req.body)); }
  catch (err) { next(err); }
};

const requestExtraBus = async (req, res, next) => {
  try { res.json(await driverActionsService.requestExtraBus(req.body)); }
  catch (err) { next(err); }
};

const reportBreakdown = async (req, res, next) => {
  try { res.json(await driverActionsService.reportBreakdown(req.body)); }
  catch (err) { next(err); }
};

const logActivity = async (req, res, next) => {
  try { res.json(await driverActionsService.logDriverActivity(req.body.driver_id, req.body.bus_id, req.body.action)); }
  catch (err) { next(err); }
};

const confirmStop = async (req, res, next) => {
  try { res.json(await driverActionsService.confirmStop(req.body.driver_id, req.body.bus_id)); }
  catch (err) { next(err); }
};

const cancelStop = async (req, res, next) => {
  try { res.json(await driverActionsService.cancelStop(req.body.driver_id, req.body.bus_id)); }
  catch (err) { next(err); }
};

module.exports = { updateBusStatus, sendDelayAlert, requestExtraBus, reportBreakdown, logActivity, confirmStop, cancelStop };
