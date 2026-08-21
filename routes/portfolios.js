const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// Container fuer mehrere getrennte Portfolios (z.B. "Portfolio 1", "Hardware Wallet", ...).
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM portfolios ORDER BY id ASC');
  res.json(rows.map(r => ({ id: r.id, name: r.name, createdAt: r.created_at })));
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'name ist Pflicht' });
  const { rows } = await pool.query('INSERT INTO portfolios (name) VALUES ($1) RETURNING *', [b.name.trim()]);
  res.status(201).json({ id: rows[0].id, name: rows[0].name, createdAt: rows[0].created_at });
});

router.delete('/:id', async (req, res) => {
  const id = +req.params.id;
  const { rows: alle } = await pool.query('SELECT id FROM portfolios ORDER BY id ASC');
  if (alle.length <= 1) return res.status(400).json({ error: 'Das letzte Portfolio kann nicht gelöscht werden' });
  await pool.query('DELETE FROM portfolio WHERE portfolio_id = $1', [id]);
  await pool.query('DELETE FROM portfolios WHERE id = $1', [id]);
  res.status(204).end();
});

module.exports = router;
