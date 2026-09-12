const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// status: worked | be_win | be_loss | failed. Kein Status (null) = noch nicht bewertet.
// be_win  = 2R wurden erreicht (SL stand schon auf BE), am Ende trotzdem BE raus.
// be_loss = 2R nie erreicht, BE-Ausstieg ohne dass das Setup geliefert hat.
const STATI = new Set(['worked', 'be_win', 'be_loss', 'failed']);
const EVENT_TYPEN = new Set(['single', 'double']);
// form: bogen (sauber) | bogen_unsauber (Bogen erkennbar, aber z.B. nur eine Kerze
// dazwischen oder Wick unter dem Mittel-Level) | kein_bogen
const FORMEN = new Set(['bogen', 'bogen_unsauber', 'kein_bogen']);

// Leerstring aus dem Formular als "nicht gesetzt" behandeln
function orNull(v) { return v === '' || v === undefined ? null : v; }
function mtfOrNull(v) {
  const n = Number(v);
  return [1, 2, 3].includes(n) ? n : null;
}

function rowOut(r) {
  return {
    id: r.id,
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
    label: r.label,
    asset: r.asset,
    tf: r.tf,
    notiz: r.notiz,
    status: r.status,
    eventTyp: r.event_typ,
    mtf: r.mtf === null || r.mtf === undefined ? null : Number(r.mtf),
    multiAsset: !!r.multi_asset,
    form: r.form,
    details: r.details
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
  const status = STATI.has(b.status) ? b.status : null;
  const { rows } = await pool.query(
    `INSERT INTO watchlist_signals (date, label, asset, tf, notiz, status, event_typ, mtf, multi_asset, form, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [b.date, b.label || null, b.asset, b.tf || null, b.notiz || null, status,
     EVENT_TYPEN.has(b.eventTyp) ? b.eventTyp : null, mtfOrNull(b.mtf), !!b.multiAsset,
     FORMEN.has(b.form) ? b.form : null, orNull(b.details)]
  );
  res.status(201).json(rowOut(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['date','date'],['label','label'],['asset','asset'],['tf','tf'],
                            ['notiz','notiz'],['status','status'],['eventTyp','event_typ'],
                            ['mtf','mtf'],['multiAsset','multi_asset'],['form','form'],['details','details']]) {
    if (b[key] === undefined) continue;
    let wert = b[key];
    if (key === 'status') wert = STATI.has(wert) ? wert : null;
    else if (key === 'eventTyp') wert = EVENT_TYPEN.has(wert) ? wert : null;
    else if (key === 'form') wert = FORMEN.has(wert) ? wert : null;
    else if (key === 'mtf') wert = mtfOrNull(wert);
    else if (key === 'multiAsset') wert = !!wert;
    else wert = orNull(wert);
    fields.push(`${col} = $${i++}`); vals.push(wert);
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
