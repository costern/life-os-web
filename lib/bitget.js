// Read-Only Zugriff auf die Bitget Spot API v2 (v1 wurde am 24.08.2026 abgeschaltet,
// Fehlercode 30032 "The V1 API has been decommissioned").
// Fills-Antwortformat wurde live gegen den echten Account verifiziert:
// { code, msg, requestTime, data: [{ userId, symbol, orderId, tradeId, orderType, side,
//   priceAvg, size, amount, feeDetail:{deduction,feeCoin,totalDeductionFee,totalFee},
//   tradeScope, cTime, uTime }] }
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

// v2, defensiv gegen leicht abweichende Feldnamen geparst (nicht live verifiziert,
// v1-Format war coinName/available/frozen/lock -> v2 vermutlich coin/available/frozen/locked).
async function getBalances() {
  const json = await call('GET', '/api/v2/spot/account/assets');
  return (json.data || []).map(d => {
    const ticker = String(d.coin || d.coinName || '').toUpperCase();
    const available = Number(d.available ?? 0);
    const frozen = Number(d.frozen ?? 0);
    const locked = Number(d.locked ?? d.lock ?? 0);
    return { ticker, available, frozen, locked, total: available + frozen + locked };
  }).filter(x => x.ticker && x.total > 0);
}

// Alle Fills abrufen (paginiert ueber idLessThan), Symbol optional -> liefert alle Paare.
async function getAllFills(maxPages = 10) {
  const all = [];
  let idLessThan = null;
  for (let i = 0; i < maxPages; i++) {
    const params = { limit: '100' };
    if (idLessThan) params.idLessThan = idLessThan;
    const json = await call('GET', '/api/v2/spot/trade/fills', params);
    const page = json.data || [];
    all.push(...page);
    if (page.length < 100) break;
    idLessThan = page[page.length - 1].tradeId;
  }
  return all;
}

const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'EURT', 'DAI']);
const QUOTE_SUFFIXES = ['USDT', 'USDC', 'BUSD', 'EUR', 'BTC', 'ETH', 'BGB'];

function splitSymbol(symbol) {
  const s = String(symbol || '').toUpperCase();
  for (const q of QUOTE_SUFFIXES) {
    if (s.endsWith(q) && s.length > q.length) return { base: s.slice(0, -q.length), quote: q };
  }
  return { base: s, quote: null };
}

// Fill (Bitget-Rohformat) in eine crypto_transactions-Zeile uebersetzen.
// Bei EUR-Paaren mit nicht-stabilem Base-Asset fehlt uns der USD-Umrechnungskurs ->
// wird ehrlich als cost_basis_known=false markiert statt geraten.
function fillToTransaction(f) {
  const { base, quote } = splitSymbol(f.symbol);
  const side = String(f.side || '').toLowerCase();
  const txType = side === 'buy' ? 'BUY' : side === 'sell' ? 'SELL' : side.toUpperCase();
  const priceAvg = Number(f.priceAvg);
  const size = Number(f.size);

  let priceUsd = null;
  let costBasisKnown = false;
  let notes = null;

  if (quote === 'USDT' || quote === 'USDC') {
    priceUsd = priceAvg;
    costBasisKnown = true;
  } else if (quote === 'EUR' && STABLECOINS.has(base)) {
    priceUsd = 1; // Stablecoin, USD-Wert genaehert
    costBasisKnown = true;
    notes = 'EUR->' + base + ' Conversion, price_usd auf ~1 USD genaehert (Stablecoin)';
  } else if (quote === 'EUR') {
    notes = 'EUR-Paar, USD-Umrechnungskurs fehlt - price_usd nicht gesetzt';
  }

  const feeAmount = f.feeDetail ? Math.abs(Number(f.feeDetail.totalFee || 0)) : 0;
  const feeAsset = f.feeDetail ? f.feeDetail.feeCoin : null;

  return {
    source: 'bitget',
    account: 'Bitget Spot',
    asset: base,
    ticker: base,
    tx_type: txType,
    amount: size,
    price_usd: priceUsd,
    fee_amount: feeAmount,
    fee_asset: feeAsset,
    market_value_usd_at_time: priceUsd != null ? priceUsd * size : null,
    cost_basis_known: costBasisKnown,
    status: 'Confirmed',
    tx_hash: null,
    external_id: 'bitget-fill-' + f.tradeId,
    occurred_at: new Date(Number(f.cTime)).toISOString(),
    notes
  };
}


// Convert-History (One-Click-Swaps, z.B. EUR->BGB o.ae.) - eigener Endpunkt, taucht NICHT
// in trade/fills auf. Feldnamen noch nicht live verifiziert -> Rohantwort zur Inspektion.
async function debugConvertRecord(params) {
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000 - 60000;
  const defaults = { limit: '100', startTime: String(now - ninetyDaysMs), endTime: String(now) };
  return call('GET', '/api/v2/convert/convert-record', Object.assign(defaults, params || {}));
}

module.exports = { getBalances, getAllFills, fillToTransaction, splitSymbol, debugConvertRecord };
