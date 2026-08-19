const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT content_md, updated_at FROM daily_reading WHERE id = 1');
  res.json(rows[0] || { content_md: '' });
});

router.put('/', async (req, res) => {
  const { content } = req.body || {};
  const { rows } = await pool.query(
    'UPDATE daily_reading SET content_md = $1, updated_at = now() WHERE id = 1 RETURNING content_md, updated_at',
    [content || '']
  );
  res.json(rows[0]);
});

module.exports = router;
