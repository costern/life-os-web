const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const bitget = require('../lib/bitget');

const COIN_NAMES = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', SUI: 'Sui', LINK: 'Chainlink',
  ONDO: 'Ondo', RENDER: 'Render', USDT: 'Tether', AAVE: 'Aave'
};

async function getOrCreateBitgetPortfolio() {
  const { rows } = await pool.query("SELECT id FROM portfolios WHERE name = 'Bitget'");
  if (rows.length) return rows[0].id;
  const ins = await pool.query("INSERT INTO portfolios (name) VALUES ('Bitget') RETURNING id");
  return ins.rows[0].id;
}

// Aktuelle Bitget-Bestaende abrufen und in die portfolio-Tabelle schreiben (Menge only,
// kein Einstandspreis - der kommt aus /sync-trades).
router.get('/sync-balances', async (req, res) => {
  try {
    const balances = await bitget.getBalances();
    const portfolioId = await getOrCreateBitgetPortfolio();

    const results = [];
    for (const b of balances) {
      const { rows: existing } = await pool.query(
        `SELECT id FROM portfolio WHERE portfolio_id = $1 AND ticker = $2 AND wallet = 'Bitget Spot'`,
        [portfolioId, b.ticker]
      );
      if (existing.length) {
        await pool.query(`UPDATE portfolio SET amount = $1, updated_at = now() WHERE id = $2`, [b.total, existing[0].id]);
        results.push({ ticker: b.ticker, amount: b.total, action: 'updated' });
      } else {
        await pool.query(
          `INSERT INTO portfolio (portfolio_id, asset, ticker, amount, wallet, chain, notiz)
           VALUES ($1,$2,$3,$4,'Bitget Spot',NULL,'Auto-Sync')`,
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

// Alle Trade-Fills abrufen, in crypto_transactions schreiben (dedupe ueber tradeId),
// danach gewichteten Einstandspreis pro Ticker neu berechnen und in portfolio.buy_price
// eintragen (nur fuer Ticker mit mind. einem cost_basis_known=true BUY).
router.get('/sync-trades', async (req, res) => {
  try {
    const fills = await bitget.getAllFills();
    const txs = fills.map(bitget.fillToTransaction);

    let inserted = 0, skippedNoPrice = [];
    for (const t of txs) {
      const r = await pool.query(
        `INSERT INTO crypto_transactions
         (source, account, asset, ticker, tx_type, amount, price_usd, fee_amount, fee_asset,
          market_value_usd_at_time, cost_basis_known, status, tx_hash, external_id, occurred_at, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (source, external_id) WHERE external_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [t.source, t.account, t.asset, t.ticker, t.tx_type, t.amount, t.price_usd, t.fee_amount, t.fee_asset,
         t.market_value_usd_at_time, t.cost_basis_known, t.status, t.tx_hash, t.external_id, t.occurred_at, t.notes]
      );
      if (r.rows.length) inserted++;
      if (!t.cost_basis_known) skippedNoPrice.push({ ticker: t.ticker, tx_type: t.tx_type, notes: t.notes });
    }

    const portfolioId = await getOrCreateBitgetPortfolio();
    const { rows: avgCosts } = await pool.query(`
      SELECT ticker, SUM(amount * price_usd) / NULLIF(SUM(amount),0) AS avg_cost_usd
      FROM crypto_transactions
      WHERE tx_type = 'BUY' AND cost_basis_known = TRUE AND status = 'Confirmed'
      GROUP BY ticker
    `);
    const updatedPrices = [];
    for (const row of avgCosts) {
      const r = await pool.query(
        `UPDATE portfolio SET buy_price = $1, updated_at = now()
         WHERE portfolio_id = $2 AND ticker = $3 AND wallet = 'Bitget Spot' RETURNING ticker`,
        [row.avg_cost_usd, portfolioId, row.ticker]
      );
      if (r.rows.length) updatedPrices.push({ ticker: row.ticker, avgCostUsd: Number(row.avg_cost_usd) });
    }

    res.json({ ok: true, fillsFetched: fills.length, newTransactionsInserted: inserted, buyPricesUpdated: updatedPrices, skippedNoPrice });
  } catch (e) {
    res.status(502).json({ error: e.message, detail: e.detail || null });
  }
});

router.get('/debug-fills', async (req, res) => {
  try {
    const json = await bitget.getAllFills(1);
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message, detail: e.detail || null });
  }
});


router.get('/debug-convert', async (req, res) => {
  try {
    const json = await bitget.debugConvertRecord(req.query);
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message, detail: e.detail || null });
  }
});


router.get('/debug-convert-all', async (req, res) => {
  try {
    const windowsBack = Math.min(Number(req.query.windowsBack) || 12, 20);
    const result = await bitget.fetchAllConvertHistory(windowsBack);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: e.message, detail: e.detail || null });
  }
});

module.exports = router;
