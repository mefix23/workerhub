const db = require('../config/db');
const Order = require('../models/Order');
const Profile = require('../models/Profile');
const Balance = require('../models/Balance');
const Transaction = require('../models/Transaction');
const Withdrawal = require('../models/Withdrawal');

const HOLD_DAYS = parseInt(process.env.WITHDRAWAL_HOLD_DAYS, 10) || 3;

// NOTE ON PAYMENTS: this MVP simulates the money flow entirely inside the
// database (a "demo" payment provider) so the full order/escrow lifecycle can
// be built and tested end to end. No real money moves. To go live, swap the
// body of `pay()` for a call to a real payment provider's API/webhook and
// only mark the order/payment as paid once that provider confirms the charge.

function create(req, res, next) {
  try {
    const { profileId, serviceDescription } = req.body;
    const profile = Profile.findById(profileId);
    if (!profile || profile.status !== 'approved') {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    if (profile.user_id === req.user.id) {
      return res.status(400).json({ error: 'You cannot order your own profile.' });
    }

    const order = Order.create({
      buyerId: req.user.id,
      profileId: profile.id,
      sellerId: profile.user_id,
      serviceDescription: serviceDescription.trim(),
      priceCents: profile.price_cents,
      currency: profile.currency,
    });

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}

function getById(req, res, next) {
  try {
    const order = Order.findById(req.params.id);
    if (!order || (order.buyer_id !== req.user.id && order.seller_id !== req.user.id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

function listMine(req, res, next) {
  try {
    res.json({ orders: Order.listForUser(req.user.id) });
  } catch (err) {
    next(err);
  }
}

// Demo "payment": buyer pays in full, funds are held by the platform (not
// released to the seller yet). Wire a real provider in here for production.
function pay(req, res, next) {
  try {
    const order = Order.findById(req.params.id);
    if (!order || order.buyer_id !== req.user.id) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.status !== 'created') {
      return res.status(409).json({ error: `Order cannot be paid from status "${order.status}".` });
    }

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO payments (order_id, amount_cents, currency, provider, status) VALUES (?, ?, ?, 'demo', 'held')`
      ).run(order.id, order.price_cents, order.currency);

      Balance.addPending(order.seller_id, order.price_cents);
      Transaction.record({
        userId: order.seller_id,
        type: 'payment_hold',
        amountCents: order.price_cents,
        relatedOrderId: order.id,
      });

      return Order.setStatus(order.id, 'paid');
    });

    res.json({ order: tx() });
  } catch (err) {
    next(err);
  }
}

function start(req, res, next) {
  try {
    const order = Order.findById(req.params.id);
    if (!order || order.seller_id !== req.user.id) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.status !== 'paid') {
      return res.status(409).json({ error: `Order cannot be started from status "${order.status}".` });
    }
    res.json({ order: Order.setStatus(order.id, 'in_progress') });
  } catch (err) {
    next(err);
  }
}

// Buyer confirms the work is done: held funds are released to the seller's
// available balance (still not withdrawn — see withdrawal endpoints).
function complete(req, res, next) {
  try {
    const order = Order.findById(req.params.id);
    if (!order || order.buyer_id !== req.user.id) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (!['paid', 'in_progress'].includes(order.status)) {
      return res.status(409).json({ error: `Order cannot be completed from status "${order.status}".` });
    }

    const tx = db.transaction(() => {
      db.prepare(`UPDATE payments SET status = 'released' WHERE order_id = ? AND status = 'held'`).run(
        order.id
      );
      Balance.movePendingToAvailable(order.seller_id, order.price_cents);
      Transaction.record({
        userId: order.seller_id,
        type: 'payment_release',
        amountCents: order.price_cents,
        relatedOrderId: order.id,
      });
      return Order.setStatus(order.id, 'completed');
    });

    res.json({ order: tx() });
  } catch (err) {
    next(err);
  }
}

function cancel(req, res, next) {
  try {
    const order = Order.findById(req.params.id);
    if (!order || (order.buyer_id !== req.user.id && order.seller_id !== req.user.id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (!['created', 'paid', 'in_progress'].includes(order.status)) {
      return res.status(409).json({ error: `Order cannot be cancelled from status "${order.status}".` });
    }

    const tx = db.transaction(() => {
      const payment = db
        .prepare(`SELECT * FROM payments WHERE order_id = ? AND status = 'held'`)
        .get(order.id);

      if (payment) {
        db.prepare(`UPDATE payments SET status = 'refunded' WHERE id = ?`).run(payment.id);
        // Remove the held funds from the seller's pending balance and log the refund.
        db.prepare(
          `UPDATE balances SET pending_cents = MAX(pending_cents - ?, 0), updated_at = datetime('now') WHERE user_id = ?`
        ).run(order.price_cents, order.seller_id);
        Transaction.record({
          userId: order.buyer_id,
          type: 'refund',
          amountCents: order.price_cents,
          relatedOrderId: order.id,
        });
      }
      return Order.setStatus(order.id, 'cancelled');
    });

    res.json({ order: tx() });
  } catch (err) {
    next(err);
  }
}

function getBalance(req, res, next) {
  try {
    res.json({ balance: Balance.getOrCreate(req.user.id) });
  } catch (err) {
    next(err);
  }
}

// Demo withdrawal request: moves funds out of "available" immediately and
// creates a withdrawal record that becomes eligible after HOLD_DAYS. A real
// deployment would only mark it "completed" once the payment provider's
// payout actually lands — this MVP only models the state machine.
function requestWithdrawal(req, res, next) {
  try {
    const amountCents = Math.round(Number(req.body.amountCents));
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return res.status(400).json({ error: 'A positive amountCents is required.' });
    }

    const balance = Balance.getOrCreate(req.user.id);
    if (amountCents > balance.available_cents) {
      return res.status(400).json({ error: 'Amount exceeds available balance.' });
    }

    const availableAt = new Date(Date.now() + HOLD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const tx = db.transaction(() => {
      Balance.deductAvailable(req.user.id, amountCents);
      Transaction.record({
        userId: req.user.id,
        type: 'withdrawal_pending',
        amountCents,
      });
      return Withdrawal.create({ userId: req.user.id, amountCents, availableAt });
    });

    res.status(201).json({ withdrawal: tx() });
  } catch (err) {
    next(err);
  }
}

function listWithdrawals(req, res, next) {
  try {
    res.json({ withdrawals: Withdrawal.listForUser(req.user.id) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  create,
  getById,
  listMine,
  pay,
  start,
  complete,
  cancel,
  getBalance,
  requestWithdrawal,
  listWithdrawals,
};
