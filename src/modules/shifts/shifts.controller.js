const shiftsService = require('./shifts.service');

const getAll = async (req, res, next) => {
  try { res.json(await shiftsService.getAllShifts()); }
  catch (err) { next(err); }
};

const getByDriver = async (req, res, next) => {
  try { res.json(await shiftsService.getShiftsByDriver(req.params.driver_id)); }
  catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try { res.status(201).json(await shiftsService.createShift(req.body)); }
  catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try { res.json(await shiftsService.updateShift(req.params.id, req.body)); }
  catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await shiftsService.deleteShift(req.params.id);
    res.json({ message: 'تم حذف الوردية بنجاح' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getByDriver, create, update, remove };