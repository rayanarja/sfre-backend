const express = require('express');
const router = express.Router();
const controller = require('./trip-history.controller');
const auth = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').tripHistory;

router.get('/', auth, controller.getAllTrips);
router.get('/user/:user_id', auth, controller.getUserTrips);
router.post('/board', auth, validate(s.boardBus), controller.boardBus);
router.put('/exit/:trip_id', auth, controller.exitBus);

module.exports = router;
