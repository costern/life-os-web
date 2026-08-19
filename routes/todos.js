const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

function rowOut(r) {
  return { id: r.id, text: r.text, thema: r.thema, prio: r.prio, notiz: r.notiz,
    due: r.due_date, done: r.done, createdAt: r.created_at };
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM todos ORDER BY done ASC, due_date NULLS LAST, created_at DESC');
  res.json(rows.map(rowOut));
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.text || !b.text.trim()) return res.status(400).json({ error: 'text ist Pflicht' });
  const { rows } = await pool.query(
    `INSERT INTO todos (text, thema, prio, notiz, due_date) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [b.text.trim(), b.thema || null, b.prio || null, b.notiz || null, b.due || null]
  );
  res.status(201).json(rowOut(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['text','text'],['thema','thema'],['prio','prio'],['notiz','notiz'],['due','due_date']]) {
    if (b[key] !== undefined) { fields.push(`${col} = $${i++}`); vals.push(b[key]); }
  }
  if (b.done !== undefined) {
    fields.push(`done = $${i++}`); vals.push(b.done);
    fields.push(`done_at = ${b.done ? 'now()' : 'NULL'}`);
  }
  if (!fields.length) return res.status(400).json({ error: 'nichts zu ändern' });
  vals.push(id);
  const { rows } = await pool.query(`UPDATE todos SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows.length) return res.status(404).json({ error: 'nicht gefunden' });
  res.json(rowOut(rows[0]));
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM todos WHERE id = $1', [+req.params.id]);
  res.status(204).end();
});

module.exports = router;
