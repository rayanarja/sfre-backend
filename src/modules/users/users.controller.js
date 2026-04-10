const usersService = require('./users.service');

const getAll = async (req, res, next) => {
  try { res.json(await usersService.getAllUsers()); }
  catch (err) { next(err); }
};
const getOne = async (req, res, next) => {
  try { res.json(await usersService.getUserById(req.params.id)); }
  catch (err) { next(err); }
};
const update = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.id)) {
      return res.status(403).json({ code: 'ERR_4030', message: 'ما فيك تعدل حساب غيرك' });
    }
    res.json(await usersService.updateUser(req.params.id, req.body));
  } catch (err) { next(err); }
};
const remove = async (req, res, next) => {
  try { res.json(await usersService.deleteUser(req.params.id)); }
  catch (err) { next(err); }
};
module.exports = { getAll, getOne, update, remove };
