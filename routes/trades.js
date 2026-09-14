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
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['sl','sl'],['tp','tp'],['exit','exit_price'],['pnl','pnl'],
                             ['fundingFees','funding_fees'],['closedAt','closed_at'],
                             ['entry1','entry1'],['entry2','entry2'],['size1','size1'],['size2','size2'],
                             ['realizedPnl','realized_pnl'],['strategy','strategy'],['tf','tf'],
                             ['name','trade_name'],['riskUsd','risk_usd']]) {
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
const KLINE_INTERVALLE = [
  ['1m', 60000], ['5m', 300000], ['15m', 900000], ['1h', 3600000],
  ['4h', 14400000], ['1d', 86400000]
];
// Erlaubte Binance-Intervalle, damit ?interval= nicht ungeprueft durchgereicht wird.
const ERLAUBTE_INTERVALLE = {
  '1m': 60000, '3m': 180000, '5m': 300000, '15m': 900000, '30m': 1800000,
  '1h': 3600000, '2h': 7200000, '4h': 14400000, '6h': 21600000, '8h': 28800000,
  '12h': 43200000, '1d': 86400000, '3d': 259200000, '1w': 604800000
};
router.get('/:id/klines', async (req, res) => {
  const id = +req.params.id;
  const { rows } = await pool.query('SELECT ticker, opened_at, closed_at FROM trades WHERE id=$1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Trade nicht gefunden' });
  const t = rows[0];
  const symbol = String(t.ticker || '').toUpperCase().trim() + 'USDT';
  const start = new Date(t.opened_at).getTime();
  const end = t.closed_at ? new Date(t.closed_at).getTime() : Date.now();

  let interval, ms;
  const gewuenscht = String(req.query.interval || '');
  if (ERLAUBTE_INTERVALLE[gewuenscht]) {
    interval = gewuenscht; ms = ERLAUBTE_INTERVALLE[gewuenscht];
  } else {
    const spanMs = Math.max(end - start, 3600000);
    interval = '1d'; ms = 86400000;
    for (const [iv, msVal] of KLINE_INTERVALLE) {
      if (spanMs / msVal <= 1000) { interval = iv; ms = msVal; break; }
    }
  }
  // Etwas Vorlauf vor dem Trade-Start zeigen, damit man den Kontext (z.B. den Boden vorm
  // Einstieg) noch sieht - 15 Kerzen des gewaehlten Intervalls, min. 1 Tag, max. 20 Tage.
  const vorlauf = Math.min(Math.max(ms * 15, 86400000), 20 * 86400000);
  const url = 'https://api.binance.com/api/v3/klines?symbol=' + encodeURIComponent(symbol) +
    '&interval=' + interval + '&startTime=' + (start - vorlauf) + '&endTime=' + (end + ms) + '&limit=1000';
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timeout);
    if (!r.ok) throw new Error('Binance ' + r.status);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error((data && data.msg) || 'unerwartete Antwort');
    res.json({
      interval,
      candles: data.map(k => [k[0], Number(k[1]), Number(k[2]), Number(k[3]), Number(k[4])])
    });
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

module.exports = router;
