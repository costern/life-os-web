const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  const { password } = req.body || {};
  if (!process.env.SITE_PASSWORD) {
    return res.status(500).json({ error: 'Server ist nicht konfiguriert (SITE_PASSWORD fehlt)' });
  }
  if (password === process.env.SITE_PASSWORD) {
    req.session.authed = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Falsches Passwort' });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  res.json({ authed: !!(req.session && req.session.authed) });
});

module.exports = router;
