const tripService = require('./trip-history.service');

const getUserTrips = async (req, res, next) => {
  try { res.json(await tripService.getUserTrips(req.params.user_id)); }
  catch (err) { next(err); }
};

const boardBus = async (req, res, next) => {
  try { res.status(201).json(await tripService.boardBus(req.body)); }
  catch (err) { next(err); }
};

const exitBus = async (req, res, next) => {
  try { res.json(await tripService.exitBus(req.params.trip_id, req.body)); }
  catch (err) { next(err); }
};

const getAllTrips = async (req, res, next) => {
  try { res.json(await tripService.getAllTrips()); }
  catch (err) { next(err); }
};

module.exports = { getUserTrips, boardBus, exitBus, getAllTrips };