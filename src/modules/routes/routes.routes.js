const express = require('express');
const router = express.Router();
const controller = require('./routes.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').routes;

router.get('/', auth, controller.getAll);
router.get('/:id', auth, controller.getOne);
router.post('/', auth, authorize('admin'), validate(s.createRoute), controller.create);
router.put('/:id', auth, authorize('admin'), validate(s.updateRoute), controller.update);
router.put('/:id/stations', auth, authorize('admin'), validate(s.saveRouteStations), controller.saveStations);
router.delete('/:id', auth, authorize('admin'), controller.remove);

module.exports = router;
