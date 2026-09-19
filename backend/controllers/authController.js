const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');

async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;

    if (User.emailExists(email)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    if (User.usernameExists(username)) {
      return res.status(409).json({ error: 'This username is already taken.' });
    }

    const passwordHash = await hashPassword(password);
    const user = User.create({ username, email, passwordHash });
    const token = signToken({ sub: user.id });

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const userWithHash = User.findByEmailWithPassword(email);

    if (!userWithHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    if (userWithHash.is_blocked) {
      return res.status(403).json({ error: 'This account has been blocked.' });
    }

    const ok = await verifyPassword(password, userWithHash.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken({ sub: userWithHash.id });
    const user = User.findById(userWithHash.id);

    res.json({ user, token });
  } catch (err) {
    next(err);
  }
}

function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, me };
