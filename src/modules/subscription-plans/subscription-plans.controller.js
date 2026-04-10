const plansService = require('./subscription-plans.service');

const getAll = async (req, res, next) => {
  try { res.json(await plansService.getAllPlans()); }
  catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try { res.json(await plansService.getPlanById(req.params.id)); }
  catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try { res.status(201).json(await plansService.createPlan(req.body)); }
  catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try { res.json(await plansService.updatePlan(req.params.id, req.body)); }
  catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await plansService.deletePlan(req.params.id);
    res.json({ message: 'تم تعطيل الخطة بنجاح' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove };