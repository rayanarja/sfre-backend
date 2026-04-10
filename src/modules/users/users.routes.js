const express = require('express');
const router = express.Router();
const usersController = require('./users.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const authorize = require('../../middlewares/role.middleware');

router.get('/', authMiddleware, authorize('admin'), usersController.getAll);
router.get('/:id', authMiddleware, usersController.getOne);
router.put('/:id', authMiddleware, usersController.update);
router.delete('/:id', authMiddleware, authorize('admin'), usersController.remove);

module.exports = router;
