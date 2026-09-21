const { ITEMS, findItem, REWARDS } = require('../constants/shop');
const Coins = require('../models/Coins');
const Shop = require('../models/Shop');

// The shop window: all items (with "owned" for a logged-in user), the balance,
// the daily bonus state and the last coin operations.
function overview(req, res, next) {
  try {
    const owned = req.user ? Shop.owned(req.user.id) : new Set();
    const body = {
      items: ITEMS.map((i) => ({ ...i, owned: owned.has(i.id) })),
      rewards: REWARDS,
    };
    if (req.user) {
      body.coins = Coins.balance(req.user.id);
      body.daily_wait_seconds = Coins.dailyWaitSeconds(req.user.id);
      body.history = Coins.history(req.user.id, 10);
    }
    res.json(body);
  } catch (err) {
    next(err);
  }
}

function buy(req, res, next) {
  try {
    const item = findItem(req.body && req.body.itemId);
    if (!item) return res.status(404).json({ error: 'Такого товара нет.' });

    const result = Shop.buy(req.user.id, item);
    if (result === 'owned') return res.status(409).json({ error: 'Это у тебя уже есть.' });
    if (result === 'funds') {
      return res.status(402).json({ error: `Не хватает монет: нужно ${item.price}.` });
    }
    res.json({ ok: true, coins: Coins.balance(req.user.id), item_id: item.id });
  } catch (err) {
    next(err);
  }
}

function daily(req, res, next) {
  try {
    if (!Coins.claimDaily(req.user.id)) {
      return res.status(429).json({
        error: 'Бонус на сегодня уже получен.',
        daily_wait_seconds: Coins.dailyWaitSeconds(req.user.id),
      });
    }
    res.json({ ok: true, added: REWARDS.daily, coins: Coins.balance(req.user.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { overview, buy, daily };
