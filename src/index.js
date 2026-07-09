require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const discoverRoutes = require('./routes/discover');
const matchesRoutes = require('./routes/matches');
const profileRoutes = require('./routes/profile');
const subscriptionRoutes = require('./routes/subscriptions');
const likesRoutes = require('./routes/likes');
const userRoutes = require('./routes/users');
const { bootstrapDatabase } = require('../scripts/bootstrap-db');
const { ensureAuthMigrations, ensureMessageDeliveryMigration, ensureProductionDataMigrations } = require('./utils/migrate');

const app = express();
const port = process.env.PORT || 3000;

// MySQL COUNT(*) can return BigInt; Express must not throw while serializing.
app.set('json replacer', (_key, value) =>
  typeof value === 'bigint' ? Number(value) : value,
);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dating-app-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/likes', likesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/users', userRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

bootstrapDatabase()
  .then(() => ensureAuthMigrations())
  .then(() => ensureMessageDeliveryMigration())
  .then(() => ensureProductionDataMigrations())
  .catch((err) => {
    console.error('Database bootstrap failed:', err.message);
  });

app.listen(port, () => {
  console.log(`Dating app API running on port ${port}`);
});
