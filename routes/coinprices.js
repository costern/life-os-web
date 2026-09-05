const express = require('express');
const router = express.Router();
const coingecko = require('../lib/coingecko');

// Sammel-Endpunkt fuer Portfolio-Kurse: EIN Request fuer beliebig viele Coins,
// server-seitig min. 45s gecacht, damit haeufiges "Aktualisieren"-Klicken nicht
// CoinGecko-Limits reisst (siehe frueheres Problem mit Einzelabfragen pro Coin).
// GET /api/coinprices?tickers=BTC,SOL,XCN,BGB
router.get('/', async (req, res) => {
  const raw = String(req.query.tickers || '').trim();
  if (!raw) return res.status(400).json({ error: 'tickers-Parameter fehlt, z.B. ?tickers=BTC,SOL' });
  const tickers = raw.split(',').map(s => s.trim()).filter(Boolean);
  try {
    const prices = await coingecko.getPrices(tickers);
    res.json({ ok: true, requested: tickers, prices });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

module.exports = router;
