const express = require('express');
const router = express.Router();
const controller = require('./shifts.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').shifts;

router.get('/', auth, controller.getAll);
router.get('/driver/:driver_id', auth, controller.getByDriver);
router.post('/', auth, authorize('admin'), validate(s.createShift), controller.create);
router.put('/:id', auth, authorize('admin'), controller.update);
router.delete('/:id', auth, authorize('admin'), controller.remove);

module.exports = router;
