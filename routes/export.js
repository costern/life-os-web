const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// Kompletter Datenexport als JSON-Datei – damit die Daten nie beim Anbieter gefangen sind.
router.get('/', async (req, res) => {
  try {
    const [trades, todos, macro, news, reading] = await Promise.all([
      pool.query('SELECT * FROM trades ORDER BY opened_at'),
      pool.query('SELECT * FROM todos ORDER BY created_at'),
      pool.query('SELECT * FROM macro_status WHERE id = 1'),
      pool.query('SELECT * FROM news ORDER BY published_at NULLS LAST'),
      pool.query('SELECT * FROM daily_reading WHERE id = 1')
    ]);
    const dump = {
      exportiertAm: new Date().toISOString(),
      trades: trades.rows,
      todos: todos.rows,
      marktlage: macro.rows[0] || null,
      news: news.rows,
      taeglichLesen: reading.rows[0] || null
    };
    const datum = new Date().toISOString().slice(0,10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="life-os-export-${datum}.json"`);
    res.send(JSON.stringify(dump, null, 2));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
