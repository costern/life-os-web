const express = require('express');
const router = express.Router();
const coingecko = require('../lib/coingecko');

// Edelmetalle sind keine Coins - CoinGecko kennt sie nicht, deshalb hier fest ein
// kleines eigenes SVG-Icon statt eines 404 (der dann als Buchstaben-Fallback im
// Frontend landet). XAG = Silber, XAU = Gold (Colin handelt beides). Zeigt das
// uebliche "drei Barren"-Symbol fuer Edelmetalle statt nur eines Buchstaben-Kuerzels.
const METALL_ICONS = {
  XAG: { bgVon: '#eef0f2', bgBis: '#b9bfc6', barHell: '#f4f6f8', barMittel: '#c7ccd1', barDunkel: '#9398a0' },
  XAU: { bgVon: '#fff3cf', bgBis: '#d7a92e', barHell: '#ffe9a8', barMittel: '#e8bb3f', barDunkel: '#b4891a' }
};
// Ein Barren als einfaches Trapez (Vorderseite heller, Deckel dunkler) - dreimal
// versetzt gestapelt ergibt die typische "Barren-Stapel"-Silhouette.
function barrenSvg(x, y, { barHell, barMittel, barDunkel }) {
  const breiteOben = 13, breiteUnten = 17, hoehe = 5.5;
  const x1 = x - breiteOben / 2, x2 = x + breiteOben / 2;
  const x3 = x + breiteUnten / 2, x4 = x - breiteUnten / 2;
  return '<polygon points="'+x1+','+y+' '+x2+','+y+' '+x3+','+(y+hoehe)+' '+x4+','+(y+hoehe)+'" fill="'+barMittel+'" stroke="'+barDunkel+'" stroke-width="0.6"/>' +
    '<polygon points="'+x1+','+y+' '+x2+','+y+' '+(x2-1.2)+','+(y+1.3)+' '+(x1+1.2)+','+(y+1.3)+'" fill="'+barHell+'"/>';
}
function metallSvg({ bgVon, bgBis, barHell, barMittel, barDunkel }) {
  const grad = 'g' + bgVon.replace('#', '');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<defs><linearGradient id="'+grad+'" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="'+bgVon+'"/><stop offset="1" stop-color="'+bgBis+'"/>' +
    '</linearGradient></defs>' +
    '<circle cx="16" cy="16" r="16" fill="url(#'+grad+')"/>' +
    barrenSvg(16, 20.5, { barHell, barMittel, barDunkel }) +
    barrenSvg(16, 15.5, { barHell, barMittel, barDunkel }) +
    barrenSvg(16, 10.5, { barHell, barMittel, barDunkel }) +
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
