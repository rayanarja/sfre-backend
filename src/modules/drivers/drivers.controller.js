const driversService = require('./drivers.service');

const getAll = async (req, res, next) => {
  try { res.json(await driversService.getAllDrivers()); }
  catch (err) { next(err); }
};
const getOne = async (req, res, next) => {
  try { res.json(await driversService.getDriverById(req.params.id)); }
  catch (err) { next(err); }
};
const create = async (req, res, next) => {
  try { res.status(201).json(await driversService.createDriver(req.body)); }
  catch (err) { next(err); }
};
const update = async (req, res, next) => {
  try { res.json(await driversService.updateDriver(req.params.id, req.body)); }
  catch (err) { next(err); }
};
const remove = async (req, res, next) => {
  try {
    await driversService.deleteDriver(req.params.id);
    res.json({ message: 'تم حذف السائق بنجاح' });
  } catch (err) { next(err); }
};
module.exports = { getAll, getOne, create, update, remove };