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
     b.tf || null, b.openedAt || null, b.source || 'manual']
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
                             ['realizedPnl','realized_pnl'],['strategy','strategy'],['tf','tf'],
                             ['name','trade_name'],['riskUsd','risk_usd'],
                             ['asset','asset'],['ticker','ticker'],['side','side'],['openedAt','opened_at']]) {
    if (b[key] !== undefined) { fields.push(`${col} = $${i++}`); vals.push(b[key]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'nichts zu ändern' });
  fields.push(`updated_at = now()`);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE trades SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows.length) return res.status(404).json({ error: 'Trade nicht gefunden' });
  res.json(rowOut(rows[0]));
});

// Entry/SL/TP-Verlauf fuers Trading-Log-Chart. Wird automatisch von einem DB-Trigger
// befuellt (siehe schema.sql) - hier wird nur gelesen.
router.get('/:id/events', async (req, res) => {
  const id = +req.params.id;
  const { rows } = await pool.query(
    'SELECT field, value, changed_at FROM trade_events WHERE trade_id=$1 ORDER BY changed_at ASC, id ASC',
    [id]
  );
  res.json(rows.map(r => ({ field: r.field, value: num(r.value), changedAt: r.changed_at })));
});

// Kursverlauf (Binance-Klines, als Kerzen) fuer den Hintergrund des Trading-Log-Charts,
// vom Trade-Start (minus etwas Vorlauf) bis zum Trade-Ende bzw. jetzt bei offenen Trades.
// Die Kerzenlaenge richtet sich nach dem Timeframe des Trades (z.B. "2W" -> 2-Wochen-Kerzen),
// nicht nach einem von Binance angebotenen Intervall - Binance kennt z.B. kein 2-Wochen- oder
// 2-Tage-Intervall. Deshalb wird bei Bedarf aus einem feineren, nativen Binance-Intervall
// hochaggregiert (mehrere Basis-Kerzen zu einer groesseren Zielkerze zusammengefasst).
const NATIVE_INTERVALLE_MS = {
  '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '2h': 7200000, '4h': 14400000, '6h': 21600000, '8h': 28800000,
  '12h': 43200000, '1d': 86400000, '3d': 259200000, '1w': 604800000
};
// Ersten Timeframe aus einem evtl. mehrteiligen TF-Feld holen (z.B. "3D, 1W" -> "3D").
function ersterTf(tf) {
  if (!tf) return '';
  return String(tf).split(/[,/]/)[0].trim().toUpperCase().replace(/\s+/g, '');
}
// "2W" -> 2 Wochen in ms, "4H" -> 4 Stunden usw. M steht (wie in Colins Notion-Tabelle) fuer
// Minuten, nicht Monate.
function zielKerzeMs(tfToken) {
  const m = /^(\d+)([MHDW])$/.exec(tfToken);
  if (!m) return null;
  const einheitMs = { M: 60000, H: 3600000, D: 86400000, W: 604800000 }[m[2]];
  return parseInt(m[1], 10) * einheitMs;
}
// Bestes natives Binance-Intervall als Basis fuer eine Zielkerzenlaenge waehlen: exakter
// Treffer wenn moeglich, sonst das groesste native Intervall, das glatt aufgeht, sonst 1-Minuten-Kerzen.
function waehleBasisIntervall(zielMs) {
  for (const [iv, ms] of Object.entries(NATIVE_INTERVALLE_MS)) {
    if (ms === zielMs) return { interval: iv, ms, gruppierung: 1 };
  }
  const kandidaten = Object.entries(NATIVE_INTERVALLE_MS)
    .filter(([, ms]) => ms < zielMs && zielMs % ms === 0)
    .sort((a, b) => b[1] - a[1]);
  if (kandidaten.length) {
    const [iv, ms] = kandidaten[0];
    return { interval: iv, ms, gruppierung: Math.round(zielMs / ms) };
  }
  return { interval: '1m', ms: 60000, gruppierung: Math.max(1, Math.round(zielMs / 60000)) };
}
router.get('/:id/klines', async (req, res) => {
  const id = +req.params.id;
  const { rows } = await pool.query('SELECT ticker, opened_at, closed_at, tf FROM trades WHERE id=$1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Trade nicht gefunden' });
  const t = rows[0];
  const symbol = String(t.ticker || '').toUpperCase().trim() + 'USDT';
  const start = new Date(t.opened_at).getTime();
  const end = t.closed_at ? new Date(t.closed_at).getTime() : Date.now();

  // Ziel-Kerzenlaenge aus dem Timeframe des Trades - ohne TF (oder unbekanntes Format)
  // Standardmaessig Tageschart.
  const tfToken = ersterTf(req.query.tf || t.tf);
  const zielMs = zielKerzeMs(tfToken) || 86400000;
  const basis = waehleBasisIntervall(zielMs);

  // Vorlauf vor dem Trade-Start, damit man den Kontext (z.B. den Boden vorm Einstieg) noch
  // sieht - standardmaessig 100 Zielkerzen, per ?vorlaufKerzen= vom Frontend aus einstellbar
  // (Colin will selbst entscheiden, wie viel Chart er sieht).
  const gewuenschteVorlaufKerzen = parseInt(req.query.vorlaufKerzen, 10);
  const vorlaufKerzen = (Number.isFinite(gewuenschteVorlaufKerzen) && gewuenschteVorlaufKerzen > 0)
    ? Math.min(gewuenschteVorlaufKerzen, 1000) : 100;
  let vorlauf = Math.max(zielMs * vorlaufKerzen, zielMs);
  // Binance liefert max. 1000 Kerzen pro Anfrage (bezogen auf das native Basis-Intervall).
  // Wuerde die Gesamtspanne (Vorlauf + Trade-Dauer) das ueberschreiten, wird der Vorlauf
  // gekuerzt - sonst wuerden die neueren Kerzen (also der eigentliche Trade) abgeschnitten
  // statt der alten.
  const dauerMs = (end - start) + zielMs;
  const maxGesamtMs = basis.ms * 950;
  if (vorlauf + dauerMs > maxGesamtMs) vorlauf = Math.max(maxGesamtMs - dauerMs, zielMs);
  const url = 'https://api.binance.com/api/v3/klines?symbol=' + encodeURIComponent(symbol) +
    '&interval=' + basis.interval + '&startTime=' + (start - vorlauf) + '&endTime=' + (end + zielMs) + '&limit=1000';
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (!r.ok) throw new Error('Binance ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error((data && data.msg) || 'unerwartete Antwort');
    const roh = data.map(k => [k[0], Number(k[1]), Number(k[2]), Number(k[3]), Number(k[4])]);

    // Falls die Zielkerze groesser als das Basis-Intervall ist: mehrere Basis-Kerzen zu einer
    // Zielkerze zusammenfassen. Buckets sind epoch-ausgerichtet (nicht kalenderausgerichtet),
    // damit sie unabhaengig vom gewaehlten Vorlauf konsistent bleiben.
    let candles;
    if (basis.gruppierung <= 1) {
      candles = roh;
    } else {
      const buckets = new Map();
      for (const c of roh) {
        const bucketStart = Math.floor(c[0] / zielMs) * zielMs;
        const b = buckets.get(bucketStart);
        if (!b) buckets.set(bucketStart, { t: bucketStart, o: c[1], h: c[2], l: c[3], c: c[4] });
        else { b.h = Math.max(b.h, c[2]); b.l = Math.min(b.l, c[3]); b.c = c[4]; }
      }
      candles = Array.from(buckets.values())
        .sort((a, b) => a.t - b.t)
        .map(b => [b.t, b.o, b.h, b.l, b.c]);
    }

    res.json({ interval: tfToken || '1D', vorlaufKerzen, candles });
  } catch (e) {
    res.status(502).json({ error: 'Kursdaten fuer ' + symbol + ' nicht ladbar: ' + e.message });
  }
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
