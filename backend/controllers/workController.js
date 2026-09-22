const path = require('path');
const fs = require('fs');
const Work = require('../models/Work');
const Notification = require('../models/Notification');
const User = require('../models/User');

const MAX_CAPTION = 300;
const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
]);

function feed(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const viewerId = req.user ? req.user.id : null;
    const works = Work.feed({ limit, offset, viewerId });
    res.json({ works });
  } catch (err) {
    next(err);
  }
}

function getOne(req, res, next) {
  try {
    const work = Work.findById(req.params.id, req.user ? req.user.id : null);
    if (!work) return res.status(404).json({ error: 'Видео не найдено.' });
    res.json({ work });
  } catch (err) {
    next(err);
  }
}

function listByUser(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Некорректный пользователь.' });
    }
    const works = Work.listByUser(userId, req.user ? req.user.id : null);
    res.json({ works });
  } catch (err) {
    next(err);
  }
}

// Multipart upload (multer) OR JSON { videoUrl, caption }
function create(req, res, next) {
  try {
    let caption = '';
    let videoUrl = null;
    let source = 'url';
    let mime = null;
    let sizeBytes = null;

    if (req.file) {
      // Uploaded file
      if (!ALLOWED_MIME.has(req.file.mimetype)) {
        fs.unlink(req.file.path, () => {});
        return res.status(400).json({
          error: 'Формат не поддерживается. Загрузи MP4, WebM или MOV.',
        });
      }
      caption = String(req.body.caption || '').trim().slice(0, MAX_CAPTION);
      videoUrl = '/uploads/works/' + path.basename(req.file.filename);
      source = 'upload';
      mime = req.file.mimetype;
      sizeBytes = req.file.size;
    } else {
      // URL-based
      const body = req.body || {};
      caption = String(body.caption || '').trim().slice(0, MAX_CAPTION);
      videoUrl = String(body.videoUrl || body.video_url || '').trim();
      if (!videoUrl) {
        return res.status(400).json({
          error: 'Загрузи файл или укажи ссылку на видео (MP4 / YouTube).',
        });
      }
      if (videoUrl.length > 500) {
        return res.status(400).json({ error: 'Ссылка слишком длинная.' });
      }
      // Basic URL sanity
      try {
        const u = new URL(videoUrl, 'http://localhost');
        if (!['http:', 'https:'].includes(u.protocol) && !videoUrl.startsWith('/')) {
          return res.status(400).json({ error: 'Некорректная ссылка.' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Некорректная ссылка.' });
      }
      source = 'url';
    }

    const work = Work.create({
      userId: req.user.id,
      caption,
      videoUrl,
      source,
      mime,
      sizeBytes,
    });
    res.status(201).json({ work });
  } catch (err) {
    next(err);
  }
}

function remove(req, res, next) {
  try {
    const result = Work.remove(req.params.id, req.user.id);
    if (result === null) return res.status(404).json({ error: 'Видео не найдено.' });
    if (result === false) return res.status(403).json({ error: 'Можно удалить только своё видео.' });
    // Best-effort delete uploaded file
    if (result.source === 'upload' && result.video_url && result.video_url.startsWith('/uploads/')) {
      const filePath = path.join(process.cwd(), 'public', result.video_url.replace(/^\//, ''));
      fs.unlink(filePath, () => {});
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

function toggleLike(req, res, next) {
  try {
    const work = Work.findById(req.params.id, req.user.id);
    if (!work) return res.status(404).json({ error: 'Видео не найдено.' });

    const { liked } = Work.toggleLike(work.id, req.user.id);
    const updated = Work.findById(work.id, req.user.id);

    if (liked) {
      Notification.create({
        userId: work.user_id,
        type: 'work_like',
        actorId: req.user.id,
        workId: work.id,
        body: `${req.user.username} лайкнул(а) твоё видео`,
      });
    }

    res.json({ work: updated, liked });
  } catch (err) {
    next(err);
  }
}

function listComments(req, res, next) {
  try {
    const work = Work.findById(req.params.id);
    if (!work) return res.status(404).json({ error: 'Видео не найдено.' });
    const comments = Work.listComments(work.id);
    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

function addComment(req, res, next) {
  try {
    const work = Work.findById(req.params.id, req.user.id);
    if (!work) return res.status(404).json({ error: 'Видео не найдено.' });

    const comment = Work.addComment(work.id, req.user.id, req.body && req.body.body);
    Notification.create({
      userId: work.user_id,
      type: 'work_comment',
      actorId: req.user.id,
      workId: work.id,
      body: `${req.user.username} прокомментировал(а) твоё видео`,
    });

    res.status(201).json({ comment, comments_count: Work.findById(work.id).comments_count });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  feed,
  getOne,
  listByUser,
  create,
  remove,
  toggleLike,
  listComments,
  addComment,
};
