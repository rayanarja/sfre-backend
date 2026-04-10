const express = require('express');
const router = express.Router();
const controller = require('./issues.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');

router.get('/', auth, controller.getAll);
router.get('/:id', auth, controller.getOne);
router.post('/', auth, authorize('admin', 'driver'), controller.create);
router.delete('/:id', auth, authorize('admin'), controller.remove);
router.put('/:id/status', auth, authorize('admin'), controller.updateStatus);

module.exports = router;
