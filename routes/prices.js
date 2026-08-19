const express = require('express');
const router = express.Router();

// Server-seitiger Proxy zu Crypto.com – vermeidet CORS-Probleme im Browser.
// Robust gegen kleinere Abweichungen im Antwortformat (Crypto.com API v1, public/get-tickers).
router.get('/:symbol', async (req, res) => {
  const symbol = String(req.params.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!symbol) return res.status(400).json({ error: 'Kein Symbol' });
  const instrument = symbol + '_USD';
  const url = `https://api.crypto.com/exchange/v1/public/get-tickers?instrument_name=${instrument}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return res.status(502).json({ error: 'Crypto.com antwortete mit ' + r.status });
    const data = await r.json();

    // Verschiedene mögliche Formen abfangen: result.data (Array) oder result direkt.
    let d = null;
    const list = data && data.result && Array.isArray(data.result.data) ? data.result.data : null;
    if (list) d = list.find(x => x.i === instrument) || list[0];
    else if (data && data.result && !Array.isArray(data.result)) d = data.result;

    if (!d) return res.status(502).json({ error: 'Kein Kurs verfügbar für ' + symbol, raw: data });

    const last = parseFloat(d.a ?? d.k ?? d.b ?? d.last);
    if (!isFinite(last)) return res.status(502).json({ error: 'Unerwartetes Kursformat', raw: d });

    res.json({
      symbol,
      last,
      high: parseFloat(d.h ?? d.high),
      low: parseFloat(d.l ?? d.low),
      changePct: (d.c ?? d.change) != null ? parseFloat(d.c ?? d.change) * 100 : null,
      ts: d.t || d.timestamp || Date.now()
    });
  } catch (e) {
    res.status(502).json({ error: 'Kurs nicht erreichbar: ' + e.message });
  }
});

module.exports = router;
