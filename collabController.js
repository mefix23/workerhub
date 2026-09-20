const db = require('../config/db');
const Collab = require('../models/Collab');
const Balance = require('../models/Balance');
const Transaction = require('../models/Transaction');
const { toCents } = require('../utils/money');
const { tierKind } = require('../constants/collabTiers');

// NOTE ON PAYMENTS: same demo model as orders (see orderController.js) — a
// purchase is marked "paid" immediately and funds go straight into the
// seller's available balance. No real payment provider is wired in. Swap the
// body of `purchase()` for a real provider call before going live.

function create(req, res, next) {
  try {
    const b = req.body;
    const gpTiers = b.gpTiers.map((t) => ({
      tierPercent: Number(t.tierPercent),
      priceCents: toCents(t.price),
    }));
    if (gpTiers.some((t) => t.priceCents === null)) {
      return res.status(400).json({ error: 'Invalid price on a GP tier.' });
    }

    const collab = Collab.create({
      creatorId: req.user.id,
      title: b.title.trim(),
      description: b.description.trim(),
      gpTiers,
    });

    res.status(201).json({ collab });
  } catch (err) {
    next(err);
  }
}

function list(req, res, next) {
  try {
    const { status, limit, offset } = req.query;
    const collabs = Collab.list({
      status: status || undefined,
      limit: limit ? Math.min(parseInt(limit, 10) || 60, 100) : 60,
      offset: offset ? parseInt(offset, 10) || 0 : 0,
    });
    res.json({ collabs });
  } catch (err) {
    next(err);
  }
}

function getById(req, res, next) {
  try {
    const collab = Collab.findById(req.params.id);
    if (!collab) return res.status(404).json({ error: 'Collab not found.' });
    res.json({ collab });
  } catch (err) {
    next(err);
  }
}

function mine(req, res, next) {
  try {
    res.json({ collabs: Collab.listByCreator(req.user.id) });
  } catch (err) {
    next(err);
  }
}

// A decorator attaches deco price tiers (125/150/175/200) once the GP part
// of the collab has reached 100%.
function attachDeco(req, res, next) {
  try {
    const collab = Collab.findById(req.params.id);
    if (!collab) return res.status(404).json({ error: 'Collab not found.' });
    if (collab.gp_percent < 100) {
      return res.status(409).json({ error: 'GP part must reach 100% before decoration can be added.' });
    }
    if (collab.decorator_id) {
      return res.status(409).json({ error: 'This collab already has a decorator.' });
    }

    const b = req.body;
    const decoTiers = (b.decoTiers || []).map((t) => ({
      tierPercent: Number(t.tierPercent),
      priceCents: toCents(t.price),
    }));
    if (!decoTiers.length || decoTiers.some((t) => t.priceCents === null)) {
      return res.status(400).json({ error: 'Invalid deco tiers.' });
    }

    const updated = Collab.attachDecoTiers({
      collabId: collab.id,
      decoratorId: req.user.id,
      decoTiers,
    });
    res.json({ collab: updated });
  } catch (err) {
    next(err);
  }
}

// A host buys rights/access to a specific completion tier of a collab.
function purchase(req, res, next) {
  try {
    const collab = Collab.findById(req.params.id);
    if (!collab) return res.status(404).json({ error: 'Collab not found.' });

    const tierPercent = Number(req.body.tierPercent);
    const kind = tierKind(tierPercent);
    if (!kind) return res.status(400).json({ error: 'Invalid tier percent.' });

    const tier = Collab.getTier(collab.id, tierPercent);
    if (!tier || !tier.is_available) {
      return res.status(404).json({ error: 'This tier is not available for purchase.' });
    }

    const sellerId = kind === 'gp' ? collab.creator_id : collab.decorator_id;
    if (!sellerId) {
      return res.status(409).json({ error: 'This tier has no assigned seller yet.' });
    }
    if (sellerId === req.user.id) {
      return res.status(400).json({ error: 'You cannot buy your own tier.' });
    }

    const tx = db.transaction(() => {
      const purchaseRow = Collab.recordPurchase({
        collabId: collab.id,
        tierPercent,
        buyerId: req.user.id,
        sellerId,
        priceCents: tier.price_cents,
      });

      // Demo escrow: funds land straight in the seller's available balance.
      Balance.getOrCreate(sellerId);
      db.prepare(
        `UPDATE balances SET available_cents = available_cents + ?, updated_at = datetime('now') WHERE user_id = ?`
      ).run(tier.price_cents, sellerId);

      Transaction.record({
        userId: sellerId,
        type: 'payment_release',
        amountCents: tier.price_cents,
      });

      const updatedCollab = Collab.bumpProgress(collab.id, tierPercent);
      return { purchase: purchaseRow, collab: updatedCollab };
    });

    res.status(201).json(tx());
  } catch (err) {
    next(err);
  }
}

function myPurchases(req, res, next) {
  try {
    res.json({ purchases: Collab.purchasesForUser(req.user.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = { create, list, getById, mine, attachDeco, purchase, myPurchases };
