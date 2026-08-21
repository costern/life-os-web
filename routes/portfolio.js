const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// Portfolio = tatsaechlich gehaltene Coins (Spot/Wallets), getrennt von den
// gehebelten Trading-Positionen. Erstmal manuell gepflegt; wallet/chain sind
// schon als Felder da, damit spaeter On-Chain-Abfrage draufgesetzt werden kann.
function rowOut(r) {
  return {
    id: r.id, asset: r.asset, ticker: r.ticker, amount: num(r.amount), buyPrice: num(r.buy_price),
    wallet: r.wallet, chain: r.chain, notiz: r.notiz, createdAt: r.created_at, updatedAt: r.updated_at
  };
}
function num(v) { return v === null || v === undefined ? null : Number(v); }

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM portfolio ORDER BY created_at DESC');
  res.json(rows.map(rowOut));
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.asset || b.amount === undefined || b.amount === null) return res.status(400).json({ error: 'asset und amount sind Pflicht' });
  const { rows } = await pool.query(
    `INSERT INTO portfolio (asset, ticker, amount, buy_price, wallet, chain, notiz)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [b.asset, (b.ticker || b.asset).toUpperCase(), b.amount, b.buyPrice || null, b.wallet || null, b.chain || null, b.notiz || null]
  );
  res.status(201).json(rowOut(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['asset','asset'],['ticker','ticker'],['amount','amount'],['buyPrice','buy_price'],
                             ['wallet','wallet'],['chain','chain'],['notiz','notiz']]) {
    if (b[key] !== undefined) { fields.push(`${col} = $${i++}`); vals.push(b[key]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'nichts zu ändern' });
  fields.push('updated_at = now()');
  vals.push(id);
  const { rows } = await pool.query(`UPDATE portfolio SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows.length) return res.status(404).json({ error: 'nicht gefunden' });
  res.json(rowOut(rows[0]));
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM portfolio WHERE id = $1', [+req.params.id]);
  res.status(204).end();
});

module.exports = router;
