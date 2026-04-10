const authService = require('./auth.service');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const loginByPhone = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const result = await authService.loginByPhone(phone, password);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.body.user_id || req.body.userId;
    const oldPassword = req.body.old_password || req.body.oldPassword;
    const newPassword = req.body.new_password || req.body.newPassword;
    const result = await authService.changePassword(userId, oldPassword, newPassword);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, loginByPhone, changePassword };