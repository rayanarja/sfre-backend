const express = require('express');
const router = express.Router();
const controller = require('./drivers.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').drivers;

router.get('/', auth, controller.getAll);
router.get('/:id', auth, controller.getOne);
router.post('/', auth, authorize('admin'), validate(s.createDriver), controller.create);
router.put('/:id', auth, authorize('admin', 'driver'), controller.update);
router.delete('/:id', auth, authorize('admin'), controller.remove);

module.exports = router;
