const express = require('express');
const router = express.Router();
const coingecko = require('../lib/coingecko');

// GET /api/coinicon/:ticker - liefert das echte Coin-Logo (von CoinGecko) statt eines
// kuratierten Sets/veralteter CDN. Per Redirect statt Proxy, damit der Browser das
// Bild selbst cachen kann; server-seitig ist die Ticker->Logo-Aufloesung sowieso lange
// gecacht (siehe lib/coingecko.js), das hier ist also meist nur ein 302 ohne Netzwerk-Call.
router.get('/:ticker', async (req, res) => {
  const ticker = String(req.params.ticker || '').trim();
  if (!ticker) return res.status(404).end();
  try {
    const icons = await coingecko.getIcons([ticker]);
    const url = icons[ticker.toUpperCase()];
    if (!url) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=86400');
    res.redirect(url);
  } catch (e) {
    res.status(502).end();
  }
});

module.exports = router;
