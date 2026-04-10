const express = require('express');
const router = express.Router();
const controller = require('./subscription-plans.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').plans;

router.get('/', controller.getAll);
router.get('/:id', controller.getOne);
router.post('/', auth, authorize('admin'), validate(s.createPlan), controller.create);
router.put('/:id', auth, authorize('admin'), controller.update);
router.delete('/:id', auth, authorize('admin'), controller.remove);

module.exports = router;
