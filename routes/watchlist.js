const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// status: win | be_win | be_loss | lose | no_entry. Kein Status (null) = noch nicht bewertet.
// be_win   = 2R wurden erreicht (SL stand schon auf BE), am Ende trotzdem BE raus.
// be_loss  = 2R nie erreicht, BE-Ausstieg ohne dass das Setup geliefert hat.
// no_entry = kein Einstieg zustande gekommen (z.B. Entry zu hoch), der Kurs ist
//            aber auch nicht mehr runtergekommen - also weder Gewinn noch Verlust.
const STATI = new Set(['win', 'be_win', 'be_loss', 'lose', 'no_entry']);
const EVENT_TYPEN = new Set(['single', 'double']);
// form: bogen (sauber) | bogen_unsauber (Bogen erkennbar, aber z.B. nur eine Kerze
// dazwischen oder Wick unter dem Mittel-Level) | kein_bogen
const FORMEN = new Set(['bogen', 'bogen_unsauber', 'kein_bogen']);
// note = Setup-Qualitaet (bewertet das Signal, nicht den Ausgang des Trades)
const NOTEN = new Set(['A++', 'A+', 'A', 'B']);
const MARKTPHASEN = new Set(['uptrend', 'downtrend', 'ranging']);
const PATTERN = new Set(['valid', 'clean', 'choppy']);
const CANDLES = new Set(['pivot', 'decent', 'gap', 'mini']);
const DIVERGENZEN = new Set(['rsi', 'none', 'hidden']);

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
    details: r.details,
    tradeId: r.trade_id,
    note: r.note,
    marktphase: r.marktphase,
    pattern: r.pattern,
    candles: r.candles,
    divLokal: r.div_lokal,
    divStruktur: r.div_struktur
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
    `INSERT INTO watchlist_signals (date, label, asset, tf, notiz, status, event_typ, mtf, multi_asset, form, details, trade_id, note, marktphase, pattern, candles, div_lokal, div_struktur)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
    [b.date, b.label || null, b.asset, b.tf || null, b.notiz || null, status,
     EVENT_TYPEN.has(b.eventTyp) ? b.eventTyp : null, mtfOrNull(b.mtf), !!b.multiAsset,
     FORMEN.has(b.form) ? b.form : null, orNull(b.details), orNull(b.tradeId),
     NOTEN.has(b.note) ? b.note : null,
     MARKTPHASEN.has(b.marktphase) ? b.marktphase : null,
     PATTERN.has(b.pattern) ? b.pattern : null,
     CANDLES.has(b.candles) ? b.candles : null,
     DIVERGENZEN.has(b.divLokal) ? b.divLokal : null,
     DIVERGENZEN.has(b.divStruktur) ? b.divStruktur : null]
  );
  res.status(201).json(rowOut(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['date','date'],['label','label'],['asset','asset'],['tf','tf'],
                            ['notiz','notiz'],['status','status'],['eventTyp','event_typ'],
                            ['mtf','mtf'],['multiAsset','multi_asset'],['form','form'],['details','details'],
                            ['tradeId','trade_id'],['note','note'],['marktphase','marktphase'],
                            ['pattern','pattern'],['candles','candles'],
                            ['divLokal','div_lokal'],['divStruktur','div_struktur']]) {
    if (b[key] === undefined) continue;
    let wert = b[key];
    if (key === 'status') wert = STATI.has(wert) ? wert : null;
    else if (key === 'note') wert = NOTEN.has(wert) ? wert : null;
    else if (key === 'marktphase') wert = MARKTPHASEN.has(wert) ? wert : null;
    else if (key === 'pattern') wert = PATTERN.has(wert) ? wert : null;
    else if (key === 'candles') wert = CANDLES.has(wert) ? wert : null;
    else if (key === 'divLokal' || key === 'divStruktur') wert = DIVERGENZEN.has(wert) ? wert : null;
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
