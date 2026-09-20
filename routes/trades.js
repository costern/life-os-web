const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

function rowOut(r) {
  return {
    id: r.id, asset: r.asset, ticker: r.ticker, name: r.trade_name, side: r.side,
    entry1: num(r.entry1), entry2: num(r.entry2), size1: num(r.size1), size2: num(r.size2),
    sl: num(r.sl), tp: num(r.tp), exit: num(r.exit_price), pnl: num(r.pnl),
    fundingFees: num(r.funding_fees), realizedPnl: num(r.realized_pnl), strategy: r.strategy, riskUsd: num(r.risk_usd),
    tf: r.tf, openedAt: r.opened_at, closedAt: r.closed_at, source: r.source
  };
}
function num(v) { return v === null || v === undefined ? null : Number(v); }
// tf kommt vom Frontend entweder schon als Array (Checkbox-Auswahl) oder - fuer alte
// Aufrufer - als kommagetrennter Text. Leere Auswahl/Text wird zu null (kein Timeframe).
function tfArray(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const liste = Array.isArray(v) ? v : String(v).split(/[,/]+/);
  const bereinigt = liste.map(s => String(s).trim()).filter(Boolean);
  return bereinigt.length ? bereinigt : null;
}

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
    `INSERT INTO trades (asset, ticker, trade_name, side, entry1, entry2, size1, size2, sl, tp, strategy, risk_usd, tf, opened_at, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, COALESCE($14, now()), $15) RETURNING *`,
    [b.asset, b.ticker || b.asset, b.name || null, b.side || 'Long', b.entry1 || null, b.entry2 || null,
     b.size1 || null, b.size2 || null, b.sl || null, b.tp || null, b.strategy || null, b.riskUsd || null,
     tfArray(b.tf) || null, b.openedAt || null, b.source || 'manual']
  );
  res.status(201).json(rowOut(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  if (b.asset !== undefined && !String(b.asset).trim()) return res.status(400).json({ error: 'asset darf nicht leer sein' });
  if (b.side !== undefined && !['Long','Short'].includes(b.side)) return res.status(400).json({ error: 'side muss Long oder Short sein' });
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['sl','sl'],['tp','tp'],['exit','exit_price'],['pnl','pnl'],
                             ['fundingFees','funding_fees'],['closedAt','closed_at'],
                             ['entry1','entry1'],['entry2','entry2'],['size1','size1'],['size2','size2'],
                             ['realizedPnl','realized_pnl'],['strategy','strategy'],
                             ['name','trade_name'],['riskUsd','risk_usd'],
                             ['asset','asset'],['ticker','ticker'],['side','side'],['openedAt','opened_at']]) {
    if (b[key] !== undefined) { fields.push(`${col} = $${i++}`); vals.push(b[key]); }
  }
  // tf ist ein TEXT[] (mehrere Timeframes moeglich) - separat normalisieren statt roh durchreichen.
  if (b.tf !== undefined) { fields.push(`tf = $${i++}`); vals.push(tfArray(b.tf)); }
  if (!fields.length) return res.status(400).json({ error: 'nichts zu ändern' });
  fields.push(`updated_at = now()`);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE trades SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows.length) return res.status(404).json({ error: 'Trade nicht gefunden' });
  res.json(rowOut(rows[0]));
});

// Entry/SL/TP-Verlauf fuers Trading-Log-Chart. Wird meist automatisch von einem DB-Trigger
// befuellt, wenn entry1/entry2/sl/tp sich aendern (siehe schema.sql) - GET liest nur.
router.get('/:id/events', async (req, res) => {
  const id = +req.params.id;
  const { rows } = await pool.query(
    'SELECT id, field, value, changed_at, note FROM trade_events WHERE trade_id=$1 ORDER BY changed_at ASC, id ASC',
    [id]
  );
  res.json(rows.map(r => ({ id: r.id, field: r.field, value: num(r.value), changedAt: r.changed_at, note: r.note })));
});

// Manueller Punkt im Verlauf, z.B. wenn Colin einen neuen Bitget-Screenshot schickt und
// darin ein Teilverkauf/eine Aufstockung zu sehen ist, die sich nicht 1:1 in einer
// entry1/entry2/sl/tp-Aenderung des Trades ausdruecken laesst - dann wird hier direkt
// ein annotierter Punkt fuer den Chart eingetragen (field bleibt trotzdem entry/sl/tp,
// damit er in dieselbe Linie einsortiert wird; note traegt den Freitext).
router.post('/:id/events', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  if (!['entry','sl','tp'].includes(b.field)) return res.status(400).json({ error: "field muss 'entry', 'sl' oder 'tp' sein" });
  if (b.value === undefined || b.value === null || !isFinite(Number(b.value))) return res.status(400).json({ error: 'value ist Pflicht (Zahl)' });
  const { rows } = await pool.query(
    `INSERT INTO trade_events (trade_id, field, value, changed_at, note)
     VALUES ($1,$2,$3, COALESCE($4, now()), $5) RETURNING id, field, value, changed_at, note`,
    [id, b.field, Number(b.value), b.changedAt || null, b.note || null]
  );
  const r = rows[0];
  res.status(201).json({ id: r.id, field: r.field, value: num(r.value), changedAt: r.changed_at, note: r.note });
});

// Trading-Log-Screenshots: Colin zeichnet seine Analyse selbst in TradingView ein und laedt
// hier einen Screenshot davon hoch, statt dass wir einen Chart im Dashboard nachbauen.
// Bilder liegen als bytea in der DB (Render hat kein persistentes Dateisystem).
const ERLAUBTE_BILDTYPEN = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

router.get('/:id/screenshots', async (req, res) => {
  const id = +req.params.id;
  const { rows } = await pool.query(
    'SELECT id, content_type, uploaded_at FROM trade_screenshots WHERE trade_id=$1 ORDER BY uploaded_at ASC, id ASC',
    [id]
  );
  res.json(rows.map(r => ({ id: r.id, contentType: r.content_type, uploadedAt: r.uploaded_at })));
});

router.post('/:id/screenshots', async (req, res) => {
  const id = +req.params.id;
  const { imageBase64 } = req.body || {};
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(imageBase64 || ''));
  if (!match) return res.status(400).json({ error: 'imageBase64 fehlt oder ungueltig' });
  const contentType = match[1];
  if (!ERLAUBTE_BILDTYPEN.has(contentType)) return res.status(400).json({ error: 'Bildtyp nicht erlaubt: ' + contentType });
  const buffer = Buffer.from(match[2], 'base64');
  const { rows } = await pool.query(
    `INSERT INTO trade_screenshots (trade_id, content_type, image_data) VALUES ($1,$2,$3)
     RETURNING id, content_type, uploaded_at`,
    [id, contentType, buffer]
  );
  const r = rows[0];
  res.status(201).json({ id: r.id, contentType: r.content_type, uploadedAt: r.uploaded_at });
});

router.get('/:id/screenshots/:sid/image', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT content_type, image_data FROM trade_screenshots WHERE id=$1 AND trade_id=$2',
    [+req.params.sid, +req.params.id]
  );
  if (!rows.length) return res.status(404).end();
  res.set('Content-Type', rows[0].content_type);
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(rows[0].image_data);
});

router.delete('/:id/screenshots/:sid', async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM trade_screenshots WHERE id=$1 AND trade_id=$2',
    [+req.params.sid, +req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Screenshot nicht gefunden' });
  res.json({ ok: true });
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

router.delete('/:id', async (req, res) => {
  const id = +req.params.id;
  const { rowCount } = await pool.query('DELETE FROM trades WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Trade nicht gefunden' });
  res.json({ ok: true });
});

module.exports = router;
