const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { authLimiter } = require('../../middlewares/rateLimiter');
const s = require('../../validations/schemas').auth;

router.post('/register', authLimiter, validate(s.register), authController.register);
router.post('/login', authLimiter, validate(s.login), authController.login);
router.post('/login-phone', authLimiter, validate(s.loginPhone), authController.loginByPhone);
router.post('/change-password', authMiddleware, validate(s.changePassword), authController.changePassword);

module.exports = router;
