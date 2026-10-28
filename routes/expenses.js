const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

const FREQUENZEN = new Set(['monthly', 'yearly']);
const TYPEN = new Set(['einkommen', 'ausgabe', 'sparen']);

function rowOut(r) {
  return { id: r.id, label: r.label, amount: Number(r.amount), frequency: r.frequency,
    typ: r.typ, sortOrder: r.sort_order, createdAt: r.created_at };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM expenses WHERE deleted_at IS NULL ORDER BY sort_order ASC, created_at ASC'
  );
  res.json(rows.map(rowOut));
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.label || !b.label.trim()) return res.status(400).json({ error: 'label ist Pflicht' });
  const amount = Number(b.amount);
  if (!isFinite(amount)) return res.status(400).json({ error: 'amount muss eine Zahl sein' });
  const frequency = FREQUENZEN.has(b.frequency) ? b.frequency : 'monthly';
  const typ = TYPEN.has(b.typ) ? b.typ : 'ausgabe';
  const { rows } = await pool.query(
    `INSERT INTO expenses (label, amount, frequency, typ, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [b.label.trim(), amount, frequency, typ, Number(b.sortOrder) || 0]
  );
  res.status(201).json(rowOut(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const fields = []; const vals = []; let i = 1;
  if (b.label !== undefined) { fields.push(`label = $${i++}`); vals.push(String(b.label).trim()); }
  if (b.amount !== undefined) {
    const amount = Number(b.amount);
    if (!isFinite(amount)) return res.status(400).json({ error: 'amount muss eine Zahl sein' });
    fields.push(`amount = $${i++}`); vals.push(amount);
  }
  if (b.frequency !== undefined) { fields.push(`frequency = $${i++}`); vals.push(FREQUENZEN.has(b.frequency) ? b.frequency : 'monthly'); }
  if (b.typ !== undefined) { fields.push(`typ = $${i++}`); vals.push(TYPEN.has(b.typ) ? b.typ : 'ausgabe'); }
  if (b.sortOrder !== undefined) { fields.push(`sort_order = $${i++}`); vals.push(Number(b.sortOrder) || 0); }
  if (!fields.length) return res.status(400).json({ error: 'nichts zu ändern' });
  vals.push(id);
  const { rows } = await pool.query(`UPDATE expenses SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`, vals);
  if (!rows.length) return res.status(404).json({ error: 'nicht gefunden' });
  res.json(rowOut(rows[0]));
});

router.delete('/:id', async (req, res) => {
  const id = +req.params.id;
  const { rows } = await pool.query('UPDATE expenses SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [id]);
  if (!rows.length) return res.status(404).json({ error: 'nicht gefunden' });
  res.json({ ok: true, id });
});

module.exports = router;
