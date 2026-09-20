const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!SECRET || SECRET === 'change_this_to_a_long_random_secret') {
  // eslint-disable-next-line no-console
  console.warn(
    '[workerhub] WARNING: JWT_SECRET is missing or using the example value. ' +
      'Set a strong, random JWT_SECRET in your .env file before deploying.'
  );
}

function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = { signToken, verifyToken };
