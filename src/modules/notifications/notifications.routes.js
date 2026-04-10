const express = require('express');
const router = express.Router();
const controller = require('./notifications.controller');
const auth = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const s = require('../../validations/schemas').notifications;

router.get('/', auth, controller.getAll);
router.post('/', auth, authorize('admin'), validate(s.createNotification), controller.create);
router.put('/:id/read', auth, controller.markAsRead);
router.delete('/:id', auth, authorize('admin'), controller.remove);
router.get('/user/:user_id', auth, controller.getUserNotifications);

module.exports = router;
