const express = require('express');
const router = express.Router();
const controller = require('./reports.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').reports;

router.post('/', auth, authorize('passenger'), validate(s.createReport), controller.create);
router.get('/', auth, controller.getAll);
router.put('/:id/status', auth, authorize('admin'), controller.updateStatus);
router.delete('/:id', auth, authorize('admin'), controller.remove);

module.exports = router;
