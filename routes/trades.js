const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

function rowOut(r) {
  return {
    id: r.id, asset: r.asset, ticker: r.ticker, name: r.trade_name, side: r.side,
    entry1: num(r.entry1), entry2: num(r.entry2), size1: num(r.size1), size2: num(r.size2),
    sl: num(r.sl), tp: num(r.tp), exit: num(r.exit_price), pnl: num(r.pnl),
    fundingFees: num(r.funding_fees), strategy: r.strategy, riskUsd: num(r.risk_usd),
    openedAt: r.opened_at, closedAt: r.closed_at, source: r.source
  };
}
function num(v) { return v === null || v === undefined ? null : Number(v); }

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM trades ORDER BY opened_at DESC');
  res.json(rows.map(rowOut));
});

router.get('/open', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM trades WHERE exit_price IS NULL ORDER BY opened_at DESC');
  res.json(rows.map(rowOut));
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.asset) return res.status(400).json({ error: 'asset ist Pflicht' });
  const { rows } = await pool.query(
    `INSERT INTO trades (asset, ticker, trade_name, side, entry1, entry2, size1, size2, sl, tp, strategy, risk_usd, opened_at, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, COALESCE($13, now()), $14) RETURNING *`,
    [b.asset, b.ticker || b.asset, b.name || null, b.side || 'Long', b.entry1 || null, b.entry2 || null,
     b.size1 || null, b.size2 || null, b.sl || null, b.tp || null, b.strategy || null, b.riskUsd || null,
     b.openedAt || null, b.source || 'manual']
  );
  res.status(201).json(rowOut(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['sl','sl'],['tp','tp'],['exit','exit_price'],['pnl','pnl'],
                             ['fundingFees','funding_fees'],['closedAt','closed_at']]) {
    if (b[key] !== undefined) { fields.push(`${col} = $${i++}`); vals.push(b[key]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'nichts zu ändern' });
  fields.push(`updated_at = now()`);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE trades SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows.length) return res.status(404).json({ error: 'Trade nicht gefunden' });
  res.json(rowOut(rows[0]));
});

router.post('/:id/close', async (req, res) => {
  const id = +req.params.id;
  const { exit } = req.body || {};
  if (exit === undefined || exit === null) return res.status(400).json({ error: 'exit ist Pflicht' });
  const { rows: cur } = await pool.query('SELECT * FROM trades WHERE id = $1', [id]);
  if (!cur.length) return res.status(404).json({ error: 'Trade nicht gefunden' });
  const t = cur[0];
  const size = Number(t.size1 || 0) + Number(t.size2 || 0);
  const avg = size ? (Number(t.entry1 || 0) * Number(t.size1 || 0) + Number(t.entry2 || 0) * Number(t.size2 || 0)) / size : 0;
  const dir = t.side === 'Short' ? -1 : 1;
  const pnl = +(dir * (exit - avg) * size).toFixed(2);
  const { rows } = await pool.query(
    `UPDATE trades SET exit_price=$1, pnl=$2, closed_at=now(), updated_at=now() WHERE id=$3 RETURNING *`,
    [exit, pnl, id]
  );
  res.json(rowOut(rows[0]));
});

module.exports = router;
