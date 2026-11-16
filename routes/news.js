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

// ---- BTC-Timeline: News + Personen-Aussagen mit Zeitpunkt (Tabelle market_events) ----
function evOut(r) {
  return { id: r.id, ts: r.ts, kind: r.kind, person: r.person, title: r.title, details: r.details,
    sentiment: r.sentiment, url: r.url, source: r.source };
}
function evCheck(it) {
  if (!it || !it.ts || isNaN(new Date(it.ts).getTime())) return 'ts (Zeitpunkt) fehlt oder ungueltig';
  if (!it.title || !String(it.title).trim()) return 'title fehlt';
  if (!['news', 'person'].includes(it.kind || 'news')) return "kind muss 'news' oder 'person' sein";
  if (!['pos', 'neg'].includes(it.sentiment)) return "sentiment muss 'pos' oder 'neg' sein";
  if ((it.kind === 'person') && !String(it.person || '').trim()) return 'person fehlt bei kind=person';
  return null;
}

router.get('/events', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM market_events ORDER BY ts');
  res.json(rows.map(evOut));
});

// Einzelnes Event oder Array von Events anlegen
router.post('/events', async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  for (const it of items) { const f = evCheck(it); if (f) return res.status(400).json({ error: f }); }
  const out = [];
  for (const it of items) {
    const { rows } = await pool.query(
      `INSERT INTO market_events (ts, kind, person, title, details, sentiment, url, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [it.ts, it.kind || 'news', it.person || null, String(it.title).trim(), it.details || null,
       it.sentiment, it.url || null, it.source || null]);
    out.push(evOut(rows[0]));
  }
  res.status(201).json(out);
});

router.delete('/events/:id', async (req, res) => {
  await pool.query('DELETE FROM market_events WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
