const notificationsService = require('./notifications.service');

const getAll = async (req, res, next) => {
  try { res.json(await notificationsService.getAllNotifications()); }
  catch (err) { next(err); }
};

const getUserNotifications = async (req, res, next) => {
  try {
    const role = req.user?.role || 'passenger';
    res.json(await notificationsService.getUserNotifications(req.params.user_id, role));
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try { res.json(await notificationsService.createNotification(req.body)); }
  catch (err) { next(err); }
};

const markAsRead = async (req, res, next) => {
  try { res.json(await notificationsService.markAsRead(req.params.id)); }
  catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try { res.json(await notificationsService.deleteNotification(req.params.id)); }
  catch (err) { next(err); }
};

module.exports = { getAll, getUserNotifications, create, markAsRead, remove };
