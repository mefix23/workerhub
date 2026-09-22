require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

require('./config/db'); // opens the DB and applies schema.sql on boot

// Optional demo data for easy cloud previews. Seed is idempotent and only
// creates records that are missing. Set SEED_DEMO_DATA=false for a blank DB.
if (process.env.SEED_DEMO_DATA === 'true') {
  require('../database/seed');
}

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');
const orderRoutes = require('./routes/orders');
const userRoutes = require('./routes/users');
const moderationRoutes = require('./routes/moderation');
const shopRoutes = require('./routes/shop');
const supportRoutes = require('./routes/support');
const reviewRoutes = require('./routes/reviews');
const collabRoutes = require('./routes/collabs');
const chatRoutes = require('./routes/chat');
const metaRoutes = require('./routes/meta');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false, // simple static frontend, no external scripts
  })
);
app.use(cors());
// Profiles carry up to 5 small photos of works, so allow a bigger body.
app.use(express.json({ limit: '4mb' })); // caps request body size
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// General API rate limit; stricter limits are applied to auth routes separately.
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/mod', moderationRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/collabs', collabRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api', metaRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use('/api', notFound);
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`WORKERHUB running at http://localhost:${PORT}`);
});
