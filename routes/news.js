const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

function rowOut(r) {
  return { id: r.id, title: r.title, summary: r.summary, url: r.url, source: r.source,
    category: r.category, sentiment: r.sentiment, importance: r.importance ? Number(r.importance) : null,
    inFocus: r.in_focus, publishedAt: r.published_at };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM news ORDER BY in_focus DESC, published_at DESC NULLS LAST LIMIT 40');
  res.json(rows.map(rowOut));
});

// Claude trägt recherchierte News ein (ersetzt alte Einträge, damit die Liste nicht endlos wächst)
router.post('/replace', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM news');
    for (const it of items) {
      await client.query(
        `INSERT INTO news (title, summary, url, source, category, sentiment, importance, in_focus, published_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [it.title, it.summary || null, it.url || null, it.source || null, it.category || null,
         it.sentiment || null, it.importance || null, !!it.inFocus, it.publishedAt || null]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ ok: true, count: items.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

module.exports = router;
