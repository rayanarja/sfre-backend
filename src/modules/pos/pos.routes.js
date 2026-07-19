const express = require('express');
const router = express.Router();
const controller = require('./pos.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { authLimiter } = require('../../middlewares/rateLimiter');
const s = require('../../validations/schemas').pos;

router.get('/active', controller.active);
router.post('/login', authLimiter, controller.login);
router.get('/dashboard', auth, authorize('pos'), controller.dashboard);
router.post('/sell', auth, authorize('pos'), validate(s.sellSubscription), controller.sell);
router.get('/transactions/:id', auth, authorize('admin'), controller.transactions);
router.post('/change-password', auth, controller.changePass);
router.get('/', auth, authorize('admin'), controller.getAll);
router.get('/:id', auth, authorize('admin'), controller.getOne);
router.post('/', auth, authorize('admin'), validate(s.createPOS), controller.create);
router.put('/:id', auth, authorize('admin'), controller.update);
router.delete('/:id', auth, authorize('admin'), controller.remove);
router.post('/:id/recharge', auth, authorize('admin'), validate(s.rechargeBalance), controller.recharge);

module.exports = router;
