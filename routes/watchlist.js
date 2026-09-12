const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

const STATI = new Set(['offen', 'unanalysiert', 'fehlsignal']);

function rowOut(r) {
  return {
    id: r.id,
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
    label: r.label,
    asset: r.asset,
    tf: r.tf,
    notiz: r.notiz,
    status: r.status
  };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM watchlist_signals ORDER BY date ASC, id ASC');
  res.json(rows.map(rowOut));
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.date) return res.status(400).json({ error: 'date ist Pflicht' });
  if (!b.asset) return res.status(400).json({ error: 'asset ist Pflicht' });
  const status = STATI.has(b.status) ? b.status : 'offen';
  const { rows } = await pool.query(
    `INSERT INTO watchlist_signals (date, label, asset, tf, notiz, status)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.date, b.label || null, b.asset, b.tf || null, b.notiz || null, status]
  );
  res.status(201).json(rowOut(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['date','date'],['label','label'],['asset','asset'],['tf','tf'],['notiz','notiz'],['status','status']]) {
    if (b[key] !== undefined) {
      if (key === 'status' && !STATI.has(b[key])) continue;
      fields.push(`${col} = $${i++}`); vals.push(b[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: 'nichts zu ändern' });
  fields.push(`updated_at = now()`);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE watchlist_signals SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows.length) return res.status(404).json({ error: 'Signal nicht gefunden' });
  res.json(rowOut(rows[0]));
});

router.delete('/:id', async (req, res) => {
  const id = +req.params.id;
  const { rowCount } = await pool.query('DELETE FROM watchlist_signals WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Signal nicht gefunden' });
  res.json({ ok: true });
});

module.exports = router;
