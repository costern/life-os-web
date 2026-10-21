const express = require('express');
const router = express.Router();
const coingecko = require('../lib/coingecko');

// Edelmetalle sind keine Coins - CoinGecko kennt sie nicht, deshalb hier fest ein
// kleines eigenes SVG-Icon statt eines 404 (der dann als Buchstaben-Fallback im
// Frontend landet). XAG = Silber, XAU = Gold (Colin handelt beides).
const METALL_ICONS = {
  XAG: { kuerzel: 'Ag', bg: '#9aa3ad', fg: '#1a1d23' },
  XAU: { kuerzel: 'Au', bg: '#d4af37', fg: '#2a2008' }
};
function metallSvg({ kuerzel, bg, fg }) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<circle cx="16" cy="16" r="16" fill="'+bg+'"/>' +
    '<text x="16" y="21" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="'+fg+'">'+kuerzel+'</text>' +
  '</svg>';
}

// GET /api/coinicon/:ticker - liefert das echte Coin-Logo (von CoinGecko) statt eines
// kuratierten Sets/veralteter CDN. Per Redirect statt Proxy, damit der Browser das
// Bild selbst cachen kann; server-seitig ist die Ticker->Logo-Aufloesung sowieso lange
// gecacht (siehe lib/coingecko.js), das hier ist also meist nur ein 302 ohne Netzwerk-Call.
router.get('/:ticker', async (req, res) => {
  const ticker = String(req.params.ticker || '').trim();
  if (!ticker) return res.status(404).end();
  const metall = METALL_ICONS[ticker.toUpperCase()];
  if (metall) {
    res.set('Cache-Control', 'public, max-age=86400');
    res.type('image/svg+xml').send(metallSvg(metall));
    return;
  }
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
