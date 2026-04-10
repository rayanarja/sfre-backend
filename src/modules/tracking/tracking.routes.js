const express = require('express');
const router = express.Router();
const controller = require('./tracking.controller');
const auth = require('../../middlewares/auth.middleware');

router.get('/', auth, controller.getAll);
router.get('/:bus_id', auth, controller.getByBus);
router.post('/', auth, controller.create);

module.exports = router;
