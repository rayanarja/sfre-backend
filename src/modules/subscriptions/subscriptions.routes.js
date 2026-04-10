const express = require('express');
const router = express.Router();
const controller = require('./subscriptions.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').subscriptions;

router.get('/', auth, controller.getAll);
router.get('/user/:user_id', auth, controller.getByUser);
router.get('/:id', auth, controller.getOne);
router.post('/', auth, validate(s.createSubscription), controller.create);
router.put('/:id', auth, controller.update);
router.delete('/:id', auth, authorize('admin'), controller.remove);
router.post('/use-trip/:user_id', auth, controller.useTrip);
router.post('/:id/family', auth, validate(s.addFamily), controller.addFamily);
router.delete('/family/:member_id', auth, controller.removeFamily);
router.put('/:id/cancel', auth, controller.cancel);

module.exports = router;
