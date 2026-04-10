const subscriptionsService = require('./subscriptions.service');

const getAll = async (req, res, next) => {
  try { res.json(await subscriptionsService.getAllSubscriptions()); }
  catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try { res.json(await subscriptionsService.getSubscriptionById(req.params.id)); }
  catch (err) { next(err); }
};

const getByUser = async (req, res, next) => {
  try {
    const sub = await subscriptionsService.getUserSubscription(req.params.user_id);
    res.json(sub || { message: 'لا يوجد اشتراك نشط' });
  }
  catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try { res.status(201).json(await subscriptionsService.createSubscription(req.body)); }
  catch (err) { next(err); }
};

const useTrip = async (req, res, next) => {
  try { res.json(await subscriptionsService.useTrip(req.params.user_id)); }
  catch (err) { next(err); }
};

const addFamily = async (req, res, next) => {
  try { res.status(201).json(await subscriptionsService.addFamilyMember(req.params.id, req.body.email)); }
  catch (err) { next(err); }
};

const removeFamily = async (req, res, next) => {
  try {
    await subscriptionsService.removeFamilyMember(req.params.member_id);
    res.json({ message: 'تم إزالة العضو' });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try { res.json(await subscriptionsService.updateSubscription(req.params.id, req.body)); }
  catch (err) { next(err); }
};

const cancel = async (req, res, next) => {
  try { res.json(await subscriptionsService.cancelSubscription(req.params.id)); }
  catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await subscriptionsService.deleteSubscription(req.params.id);
    res.json({ message: 'تم حذف الاشتراك بنجاح' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, getByUser, create, useTrip, addFamily, removeFamily, update, cancel, remove };
