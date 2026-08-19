require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');

const initDb = require('./db/init');
const { requireAuthOrClaude, requirePageLogin } = require('./lib/auth');

const authRoutes = require('./routes/auth');
const tradesRoutes = require('./routes/trades');
const todosRoutes = require('./routes/todos');
const macroRoutes = require('./routes/macro');
const newsRoutes = require('./routes/news');
const pricesRoutes = require('./routes/prices');
const readingRoutes = require('./routes/reading');
const exportRoutes = require('./routes/export');
const calendarRoutes = require('./routes/calendar');

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cookieSession({
  name: 'session',
  secret: process.env.SESSION_SECRET || 'change-me-please',
  maxAge: 30 * 24 * 60 * 60 * 1000
}));

// Login-Endpunkte offen, alles andere unter /api geschützt (Session ODER Claude-Token)
app.use('/api', authRoutes);
app.use('/api/trades', requireAuthOrClaude, tradesRoutes);
app.use('/api/todos', requireAuthOrClaude, todosRoutes);
app.use('/api/macro', requireAuthOrClaude, macroRoutes);
app.use('/api/news', requireAuthOrClaude, newsRoutes);
app.use('/api/reading', requireAuthOrClaude, readingRoutes);
app.use('/api/prices', requireAuthOrClaude, pricesRoutes);
app.use('/api/export', requireAuthOrClaude, exportRoutes);
app.use('/api/calendar', requireAuthOrClaude, calendarRoutes);

// Statische Seiten: login.html frei, alles andere hinter Login
app.use('/login.html', express.static(path.join(__dirname, 'public', 'login.html')));
app.use((req, res, next) => {
  if (req.path === '/login.html' || req.path.startsWith('/api')) return next();
  return requirePageLogin(req, res, next);
});
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log('Life OS Web läuft auf Port ' + PORT));
  })
  .catch(err => {
    console.error('DB-Init fehlgeschlagen:', err);
    process.exit(1);
  });
