const express = require('express');
const router = express.Router();
const controller = require('./bus-tracker.controller');
const auth = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').busTracker;

router.put('/position/:bus_id', auth, validate(s.updatePosition), controller.updatePosition);
router.get('/map', auth, controller.getMapBuses);
router.get('/find-buses', auth, controller.findBuses);
router.get('/stations/:route_id', auth, controller.getStations);

module.exports = router;
