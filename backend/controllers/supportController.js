const Ticket = require('../models/Ticket');
const { isStaff } = require('../middleware/auth');

const MAX_OPEN_PER_USER = 5;
const MAX_MESSAGES_PER_TICKET = 200;

function text(v) {
  return typeof v === 'string' ? v.trim() : '';
}

function canAccess(user, ticket) {
  return !!ticket && (ticket.user_id === user.id || isStaff(user));
}

function createTicket(req, res, next) {
  try {
    const subject = text(req.body && req.body.subject);
    const body = text(req.body && req.body.body);
    if (subject.length < 3 || subject.length > 100) {
      return res.status(400).json({ error: 'Тема: от 3 до 100 символов.' });
    }
    if (body.length < 10 || body.length > 2000) {
      return res.status(400).json({ error: 'Сообщение: от 10 до 2000 символов.' });
    }
    if (Ticket.openCountByUser(req.user.id) >= MAX_OPEN_PER_USER) {
      return res.status(409).json({
        error: `У тебя уже ${MAX_OPEN_PER_USER} открытых обращений. Закрой старые или дождись ответа.`,
      });
    }
    const id = Ticket.create(req.user.id, subject, body);
    res.status(201).json({ ticket: { id } });
  } catch (err) {
    next(err);
  }
}

function myTickets(req, res, next) {
  try {
    res.json({ tickets: Ticket.listByUser(req.user.id) });
  } catch (err) {
    next(err);
  }
}

// Staff: every ticket (optionally only open / closed).
function allTickets(req, res, next) {
  try {
    res.json({ tickets: Ticket.listAll(req.query.status) });
  } catch (err) {
    next(err);
  }
}

function getTicket(req, res, next) {
  try {
    const ticket = Ticket.findById(req.params.id);
    if (!canAccess(req.user, ticket)) return res.status(404).json({ error: 'Обращение не найдено.' });
    res.json({
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        created_at: ticket.created_at,
        user_id: ticket.user_id,
        username: ticket.username,
      },
      messages: Ticket.messages(ticket.id),
    });
  } catch (err) {
    next(err);
  }
}

function addMessage(req, res, next) {
  try {
    const ticket = Ticket.findById(req.params.id);
    if (!canAccess(req.user, ticket)) return res.status(404).json({ error: 'Обращение не найдено.' });
    if (ticket.status !== 'open') {
      return res.status(409).json({ error: 'Обращение закрыто. Открой его снова, чтобы написать.' });
    }
    const body = text(req.body && req.body.body);
    if (body.length < 1 || body.length > 2000) {
      return res.status(400).json({ error: 'Сообщение: от 1 до 2000 символов.' });
    }
    if (Ticket.messageCount(ticket.id) >= MAX_MESSAGES_PER_TICKET) {
      return res.status(409).json({ error: 'В этом обращении слишком много сообщений. Создай новое.' });
    }
    // A staff member writing in his own ticket is a normal user message.
    const asStaff = isStaff(req.user) && req.user.id !== ticket.user_id;
    Ticket.addMessage(ticket.id, req.user.id, asStaff, body);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

function setStatus(req, res, next) {
  try {
    const ticket = Ticket.findById(req.params.id);
    if (!canAccess(req.user, ticket)) return res.status(404).json({ error: 'Обращение не найдено.' });
    const status = req.body && req.body.status;
    if (!['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Неверный статус.' });
    }
    Ticket.setStatus(ticket.id, status);
    res.json({ ok: true, status });
  } catch (err) {
    next(err);
  }
}

module.exports = { createTicket, myTickets, allTickets, getTicket, addMessage, setStatus };
