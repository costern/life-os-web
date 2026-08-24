// Read-Only Zugriff auf die Bitget Spot API (v1 fuer Balances, v2 fuer Trade-Fills).
// Doku v1 (bestaetigt via bitgetlimited.github.io/apidoc/en/spot/):
//   GET /api/spot/v1/account/assets -> [{coinName, available, frozen, lock, uTime}]
// v2 Fills-Endpoint (spot/trade/fills) ist laut ccxt-Konfiguration vorhanden, das genaue
// Antwortformat wurde NICHT verifiziert -> debugFills() gibt Rohdaten zurueck, bevor wir
// daraus echte BUY/SELL-Zeilen ableiten.
const crypto = require('crypto');

const BASE = 'https://api.bitget.com';

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} fehlt als Environment-Variable`);
  return v;
}

function sign(timestamp, method, requestPath, queryString, body) {
  const secret = must('BITGET_API_SECRET');
  const prehash = timestamp + method.toUpperCase() + requestPath + (queryString ? '?' + queryString : '') + (body || '');
  return crypto.createHmac('sha256', secret).update(prehash).digest('base64');
}

async function call(method, path, query) {
  const apiKey = must('BITGET_API_KEY');
  const passphrase = must('BITGET_API_PASSPHRASE');
  const qs = query ? new URLSearchParams(query).toString() : '';
  const timestamp = String(Date.now());
  const signature = sign(timestamp, method, path, qs, '');
  const url = BASE + path + (qs ? '?' + qs : '');
  const res = await fetch(url, {
    method,
    headers: {
      'ACCESS-KEY': apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
      'locale': 'en-US'
    }
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok || (json && json.code && json.code !== '00000')) {
    const err = new Error('Bitget-API-Fehler: ' + (json.msg || json.message || res.status));
    err.detail = json;
    throw err;
  }
  return json;
}

// Bestaetigtes, stabiles v1-Format.
async function getBalances() {
  const json = await call('GET', '/api/spot/v1/account/assets');
  return (json.data || []).map(d => ({
    ticker: String(d.coinName || '').toUpperCase(),
    available: Number(d.available),
    frozen: Number(d.frozen),
    lock: Number(d.lock),
    total: Number(d.available) + Number(d.frozen) + Number(d.lock)
  })).filter(x => x.total > 0);
}

// Noch nicht final geparst -> liefert Rohantwort zur Inspektion.
async function debugFills(params) {
  return call('GET', '/api/v2/spot/trade/fills', params || { limit: '50' });
}

module.exports = { getBalances, debugFills };
