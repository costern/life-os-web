const express = require('express');
const pool = require('../db/pool');
const coingecko = require('../lib/coingecko');
const router = express.Router();

// Portfolio = tatsaechlich gehaltene Coins (Spot/Wallets), getrennt von den
// gehebelten Trading-Positionen. Erstmal manuell gepflegt; wallet/chain sind
// schon als Felder da, damit spaeter On-Chain-Abfrage draufgesetzt werden kann.
function rowOut(r) {
  return {
    id: r.id, portfolioId: r.portfolio_id, asset: r.asset, ticker: r.ticker, amount: num(r.amount), buyPrice: num(r.buy_price),
    wallet: r.wallet, chain: r.chain, notiz: r.notiz, createdAt: r.created_at, updatedAt: r.updated_at
  };
}
function num(v) { return v === null || v === undefined ? null : Number(v); }

router.get('/', async (req, res) => {
  const portfolioId = +(req.query.portfolioId || 1);
  const { rows } = await pool.query('SELECT * FROM portfolio WHERE portfolio_id = $1 ORDER BY created_at DESC', [portfolioId]);
  res.json(rows.map(rowOut));
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.asset || b.amount === undefined || b.amount === null) return res.status(400).json({ error: 'asset und amount sind Pflicht' });
  const portfolioId = +(b.portfolioId || 1);
  const { rows } = await pool.query(
    `INSERT INTO portfolio (portfolio_id, asset, ticker, amount, buy_price, wallet, chain, notiz)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [portfolioId, b.asset, (b.ticker || b.asset).toUpperCase(), b.amount, b.buyPrice || null, b.wallet || null, b.chain || null, b.notiz || null]
  );
  res.status(201).json(rowOut(rows[0]));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['asset','asset'],['ticker','ticker'],['amount','amount'],['buyPrice','buy_price'],
                             ['wallet','wallet'],['chain','chain'],['notiz','notiz']]) {
    if (b[key] !== undefined) { fields.push(`${col} = $${i++}`); vals.push(b[key]); }
  }
  if (!fields.length) return res.status(400).json({ error: 'nichts zu ändern' });
  fields.push('updated_at = now()');
  vals.push(id);
  const { rows } = await pool.query(`UPDATE portfolio SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows.length) return res.status(404).json({ error: 'nicht gefunden' });
  res.json(rowOut(rows[0]));
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM portfolio WHERE id = $1', [+req.params.id]);
  res.status(204).end();
});

// ---------- Performance-Verlauf (Snapshots) ----------

// GET /api/portfolio/history?portfolioId=1&range=1m|6m|1y|all
router.get('/history', async (req, res) => {
  const portfolioId = +(req.query.portfolioId || 1);
  const tage = { '1m': 30, '6m': 182, '1y': 365, all: 3650 }[req.query.range] || 365;
  const { rows } = await pool.query(
    `SELECT taken_at, value_usd, estimated FROM portfolio_snapshots
     WHERE portfolio_id = $1 AND taken_at >= (CURRENT_DATE - $2::int)
     ORDER BY taken_at ASC`,
    [portfolioId, tage]
  );
  res.json(rows.map(r => ({ date: r.taken_at.toISOString().slice(0, 10), value: num(r.value_usd), estimated: r.estimated })));
});

async function berechneAktuellenWert(portfolioId) {
  const { rows } = await pool.query('SELECT amount, ticker, asset, buy_price FROM portfolio WHERE portfolio_id = $1', [portfolioId]);
  if (!rows.length) return 0;
  const tickerListe = [...new Set(rows.map(r => (r.ticker || r.asset).toUpperCase()))];
  const preise = await coingecko.getPrices(tickerListe);
  let gesamt = 0;
  for (const r of rows) {
    const t = (r.ticker || r.asset).toUpperCase();
    const p = preise[t];
    if (p && isFinite(p.last)) gesamt += Number(r.amount) * p.last;
    else if (r.buy_price != null) gesamt += Number(r.amount) * Number(r.buy_price);
  }
  return gesamt;
}

// POST /api/portfolio/snapshot?portfolioId=1 - nimmt HEUTE einen echten Snapshot auf.
// Upsert, damit mehrfaches Aufrufen am selben Tag (z.B. bei jedem Seitenaufruf) keine
// Duplikate anlegt, sondern nur den Tageswert aktuell haelt.
router.post('/snapshot', async (req, res) => {
  const portfolioId = +(req.query.portfolioId || req.body?.portfolioId || 1);
  try {
    const wert = await berechneAktuellenWert(portfolioId);
    const { rows } = await pool.query(
      `INSERT INTO portfolio_snapshots (portfolio_id, taken_at, value_usd, estimated)
       VALUES ($1, CURRENT_DATE, $2, false)
       ON CONFLICT (portfolio_id, taken_at) DO UPDATE SET value_usd = EXCLUDED.value_usd, estimated = false
       RETURNING taken_at, value_usd`,
      [portfolioId, wert]
    );
    res.json({ ok: true, date: rows[0].taken_at.toISOString().slice(0, 10), value: num(rows[0].value_usd) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/portfolio/backfill?portfolioId=1 - einmalige GESCHAETZTE 12-Monats-Historie:
// nimmt die JETZIGEN Bestaende als konstant an und multipliziert sie mit historischen
// Tageskursen. Ungenau fuer Zeitraeume, in denen sich die Bestaende tatsaechlich
// geaendert haben (z.B. Coins dazugekommen) - deshalb estimated=true, und ueberschreibt
// nie einen bereits echten Snapshot (WHERE-Klausel im ON CONFLICT).
router.post('/backfill', async (req, res) => {
  const portfolioId = +(req.query.portfolioId || req.body?.portfolioId || 1);
  try {
    const { rows: holdings } = await pool.query('SELECT amount, ticker, asset FROM portfolio WHERE portfolio_id = $1', [portfolioId]);
    if (!holdings.length) return res.json({ ok: true, tage: 0 });
    const tickerListe = [...new Set(holdings.map(h => (h.ticker || h.asset).toUpperCase()))];
    const historie = await coingecko.getHistoricalDaily(tickerListe, 365);

    const alleDaten = new Set();
    for (const map of Object.values(historie)) if (map) for (const d of map.keys()) alleDaten.add(d);
    const heute = new Date().toISOString().slice(0, 10);

    let geschrieben = 0;
    for (const datum of alleDaten) {
      if (datum === heute) continue; // heute macht /snapshot, nicht die Schaetzung
      let wert = 0, irgendeinPreis = false;
      for (const h of holdings) {
        const t = (h.ticker || h.asset).toUpperCase();
        const preis = historie[t] && historie[t].get(datum);
        if (preis != null) { wert += Number(h.amount) * preis; irgendeinPreis = true; }
      }
      if (!irgendeinPreis) continue;
      await pool.query(
        `INSERT INTO portfolio_snapshots (portfolio_id, taken_at, value_usd, estimated)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (portfolio_id, taken_at) DO UPDATE SET value_usd = EXCLUDED.value_usd
           WHERE portfolio_snapshots.estimated = true`,
        [portfolioId, datum, wert]
      );
      geschrieben++;
    }
    res.json({ ok: true, tage: geschrieben });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
