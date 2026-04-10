const express = require('express');
const router = express.Router();
const controller = require('./stations.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').stations;

router.get('/suggestions', controller.suggestions);
router.get('/hybrid-suggestions', controller.hybridSuggestions);
router.get('/smart-search', auth, controller.smartSearch);
router.get('/plan-route', auth, controller.planRoute);
router.get('/plan-route-v2', auth, controller.planRouteV2);
router.get('/search', auth, controller.searchDestination);
router.get('/', auth, controller.getAll);
router.get('/:id', auth, controller.getOne);
router.post('/', auth, authorize('admin'), validate(s.createStation), controller.create);
router.put('/:id', auth, authorize('admin'), controller.update);
router.delete('/:id', auth, authorize('admin'), controller.remove);

module.exports = router;
