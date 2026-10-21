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
// pyramidenfoermig gestapelt (zwei unten, einer oben in der Mitte) ergibt die
// uebliche "Barren-Stapel"-Silhouette.
function barrenSvg(x, y, { barHell, barMittel, barDunkel }) {
  const breiteOben = 8, breiteUnten = 10.5, hoehe = 5.5;
  const x1 = x - breiteOben / 2, x2 = x + breiteOben / 2;
  const x3 = x + breiteUnten / 2, x4 = x - breiteUnten / 2;
  return '<polygon points="'+x1+','+y+' '+x2+','+y+' '+x3+','+(y+hoehe)+' '+x4+','+(y+hoehe)+'" fill="'+barMittel+'" stroke="'+barDunkel+'" stroke-width="0.5"/>' +
    '<polygon points="'+x1+','+y+' '+x2+','+y+' '+(x2-0.9)+','+(y+1)+' '+(x1+0.9)+','+(y+1)+'" fill="'+barHell+'"/>';
}
function metallSvg({ bgVon, bgBis, barHell, barMittel, barDunkel }) {
  const grad = 'g' + bgVon.replace('#', '');
  const farben = { barHell, barMittel, barDunkel };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    '<defs><linearGradient id="'+grad+'" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="'+bgVon+'"/><stop offset="1" stop-color="'+bgBis+'"/>' +
    '</linearGradient></defs>' +
    '<circle cx="16" cy="16" r="16" fill="url(#'+grad+')"/>' +
    barrenSvg(10.5, 18, farben) +
    barrenSvg(21.5, 18, farben) +
    barrenSvg(16, 11.5, farben) +
  '</svg>';
}

// GET /api/coinicon/:ticker - liefert das echte Coin-Logo (von CoinGecko) statt eines
// kuratierten Sets/veralteter CDN. Per Redirect statt Proxy, damit der Browser das
// Bild selbst cachen kann; server-seitig ist die Ticker->Logo-Aufloesung sowieso lange
// gecacht (siehe lib/coingecko.js), das hier ist also meist nur ein 302 ohne Netzwerk-Call.
router.get('/:ticker', async (req, res) => {
  const ticker = String(req.params.ticker || '').trim();
  if (!ticker) return res.status(404).end();
  // Praefix-Erkennung, nicht exaktes Match - im Frontend wird oft r.ticker verwendet,
  // und der ist bei den Live-Trades z.B. "XAGUSDT", nicht nur "XAG".
  const u = ticker.toUpperCase();
  const metall = u.startsWith('XAG') ? METALL_ICONS.XAG : u.startsWith('XAU') ? METALL_ICONS.XAU : null;
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
