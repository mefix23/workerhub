const Profile = require('../models/Profile');
const User = require('../models/User');
const Review = require('../models/Review');
const { isStaff } = require('../middleware/auth');

const MAX_PENDING_PER_AUTHOR = 3;

// Same visibility rule as for the profile page itself.
function isPublicProfile(profile) {
  if (!profile) return false;
  const owner = User.findById(profile.user_id);
  return profile.status === 'approved' && profile.is_active === 1 && !!owner && !owner.is_blocked;
}

function listForProfile(req, res, next) {
  try {
    const profile = Profile.findById(req.params.id);
    const canSeeAll = !!profile && !!req.user && (profile.user_id === req.user.id || isStaff(req.user));
    if (!profile || (!isPublicProfile(profile) && !canSeeAll)) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    const mine = req.user ? Review.findByAuthorProfile(profile.id, req.user.id) : null;
    res.json({
      reviews: Review.listApproved(profile.id),
      summary: Review.summary(profile.id),
      mine: mine
        ? { id: mine.id, rating: mine.rating, text: mine.text, status: mine.status, reject_reason: mine.reject_reason }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const profile = Profile.findById(req.params.id);
    if (!isPublicProfile(profile)) return res.status(404).json({ error: 'Анкета не найдена.' });
    if (profile.user_id === req.user.id) {
      return res.status(403).json({ error: 'Нельзя оставить отзыв на свою анкету.' });
    }

    const b = req.body || {};
    const rating = Number(b.rating);
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Поставь оценку от 1 до 5.' });
    }
    if (text.length < 10 || text.length > 500) {
      return res.status(400).json({ error: 'Отзыв: от 10 до 500 символов.' });
    }
    if (new Set(text.toLowerCase().replace(/\s/g, '')).size < 4) {
      return res.status(400).json({ error: 'Напиши отзыв нормально, своими словами.' });
    }

    if (Review.findByAuthorProfile(profile.id, req.user.id)) {
      return res.status(409).json({ error: 'Ты уже оставлял отзыв на эту анкету.' });
    }
    if (Review.pendingCountByAuthor(req.user.id) >= MAX_PENDING_PER_AUTHOR) {
      return res.status(429).json({
        error: `У тебя уже ${MAX_PENDING_PER_AUTHOR} отзыва на проверке. Дождись решения модератора.`,
      });
    }

    const review = Review.create({ profileId: profile.id, authorId: req.user.id, rating, text });
    res.status(201).json({ review: { id: review.id, status: review.status } });
  } catch (err) {
    next(err);
  }
}

// The author can delete his own review; staff can delete any.
function remove(req, res, next) {
  try {
    const review = Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: 'Отзыв не найден.' });
    if (review.author_id !== req.user.id && !isStaff(req.user)) {
      return res.status(403).json({ error: 'Нельзя удалить чужой отзыв.' });
    }
    Review.remove(review.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listForProfile, create, remove };
