const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const {
  feed,
  getOne,
  listByUser,
  create,
  remove,
  toggleLike,
  listComments,
  addComment,
} = require('../controllers/workController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'works');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
    const safe = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 40 * 1024 * 1024 }, // 40 MB
  fileFilter: (_req, file, cb) => {
    const ok = /video\/(mp4|webm|quicktime|x-msvideo)/.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Формат не поддерживается. Загрузи MP4, WebM или MOV.'));
  },
});

const router = express.Router();

router.get('/', optionalAuth, feed);
router.get('/user/:userId', optionalAuth, listByUser);
router.get('/:id', optionalAuth, getOne);
router.post(
  '/',
  requireAuth,
  (req, res, next) => {
    upload.single('video')(req, res, (err) => {
      if (err) {
        err.status = 400;
        return next(err);
      }
      next();
    });
  },
  create
);
router.delete('/:id', requireAuth, remove);
router.post('/:id/like', requireAuth, toggleLike);
router.get('/:id/comments', optionalAuth, listComments);
router.post('/:id/comments', requireAuth, addComment);

module.exports = router;
