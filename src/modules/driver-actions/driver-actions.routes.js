const express = require('express');
const router = express.Router();
const controller = require('./driver-actions.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').driverActions;

router.put('/bus-status/:bus_id', auth, authorize('driver', 'admin'), controller.updateBusStatus);
router.post('/delay-alert', auth, authorize('driver'), validate(s.delayAlert), controller.sendDelayAlert);
router.post('/request-bus', auth, authorize('driver'), validate(s.requestBus), controller.requestExtraBus);
router.post('/report-breakdown', auth, authorize('driver'), validate(s.reportBreakdown), controller.reportBreakdown);
router.post('/log-activity', auth, authorize('driver'), validate(s.logActivity), controller.logActivity);
router.post('/confirm-stop', auth, authorize('driver'), validate(s.confirmStop), controller.confirmStop);
router.post('/cancel-stop', auth, authorize('driver'), validate(s.confirmStop), controller.cancelStop);

module.exports = router;
