const express = require('express');
const router = express.Router();
const controller = require('./buses.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').buses;

router.get('/nearby', auth, controller.nearby);
router.get('/:id/qr', auth, controller.getQR);
router.post('/verify-qr', auth, controller.verifyQR);
router.get('/', auth, controller.getAll);
router.get('/:id', auth, controller.getOne);
router.post('/', auth, authorize('admin'), validate(s.createBus), controller.create);
router.put('/:id', auth, authorize('admin', 'driver'), validate(s.updateBus), controller.update);
router.delete('/:id', auth, authorize('admin'), controller.remove);

module.exports = router;
