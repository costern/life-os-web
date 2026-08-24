const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const bitget = require('../lib/bitget');

const COIN_NAMES = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', SUI: 'Sui', LINK: 'Chainlink',
  ONDO: 'Ondo', RENDER: 'Render', USDT: 'Tether'
};

// Aktuelle Bitget-Bestaende abrufen und in die bestehende portfolio-Tabelle schreiben,
// unter einem eigenen "Bitget"-Portfolio (wallet='Bitget Spot'). buy_price wird dabei
// NICHT gesetzt/veraendert (bleibt null bzw. was manuell schon eingetragen war) -
// dafuer fehlt uns noch die Kaufhistorie, siehe /debug-fills.
router.get('/sync-balances', async (req, res) => {
  try {
    const balances = await bitget.getBalances();

    let { rows: pf } = await pool.query("SELECT id FROM portfolios WHERE name = 'Bitget'");
    let portfolioId;
    if (pf.length) portfolioId = pf[0].id;
    else {
      const ins = await pool.query("INSERT INTO portfolios (name) VALUES ('Bitget') RETURNING id");
      portfolioId = ins.rows[0].id;
    }

    const results = [];
    for (const b of balances) {
      const { rows: existing } = await pool.query(
        `SELECT id, buy_price FROM portfolio WHERE portfolio_id = $1 AND ticker = $2 AND wallet = 'Bitget Spot'`,
        [portfolioId, b.ticker]
      );
      if (existing.length) {
        await pool.query(
          `UPDATE portfolio SET amount = $1, updated_at = now() WHERE id = $2`,
          [b.total, existing[0].id]
        );
        results.push({ ticker: b.ticker, amount: b.total, action: 'updated' });
      } else {
        await pool.query(
          `INSERT INTO portfolio (portfolio_id, asset, ticker, amount, wallet, chain, notiz)
           VALUES ($1,$2,$3,$4,'Bitget Spot',NULL,'Auto-Sync (Balances only, kein Einstandspreis)')`,
          [portfolioId, COIN_NAMES[b.ticker] || b.ticker, b.ticker, b.total]
        );
        results.push({ ticker: b.ticker, amount: b.total, action: 'inserted' });
      }
    }
    res.json({ ok: true, portfolioId, synced: results });
  } catch (e) {
    res.status(502).json({ error: e.message, detail: e.detail || null });
  }
});

// Temporaerer Debug-Endpunkt: zeigt die rohe Bitget-Fills-Antwort, damit wir das
// Antwortformat einmal echt sehen, bevor wir daraus BUY/SELL-Zeilen mit echten
// Einstandspreisen ableiten. Kann spaeter entfernt werden.
router.get('/debug-fills', async (req, res) => {
  try {
    const json = await bitget.debugFills(req.query);
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message, detail: e.detail || null });
  }
});

module.exports = router;
