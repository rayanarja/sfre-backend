const express = require('express');
const router = express.Router();
const controller = require('./lost-items.controller');
const auth = require('../../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../../uploads/lost-items')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', auth, controller.getAll);
router.get('/:id', auth, controller.getOne);
router.post('/', auth, upload.single('image'), controller.create);
router.put('/:id', auth, controller.update);
router.put('/:id/status', auth, controller.updateStatus);
router.delete('/:id', auth, controller.remove);

module.exports = router;
