// CoinGecko-Anbindung fuer die Portfolio-Kurse. Zwei Cache-Ebenen, damit
// haeufiges Klicken auf "Aktualisieren" nicht in Rate-Limits laeuft:
//  1) coinListCache: Ticker -> CoinGecko-ID, 24h gueltig (aendert sich praktisch nie)
//  2) priceCache: fertige Preisantwort, mind. MIN_INTERVAL_MS gueltig, unabhaengig
//     davon wie oft die Route aufgerufen wird
const BASE = 'https://api.coingecko.com/api/v3';
const MIN_INTERVAL_MS = 45 * 1000;
const LIST_TTL_MS = 24 * 60 * 60 * 1000;

let coinListCache = null; // Map: TICKER (upper) -> coingecko id
let coinListFetchedAt = 0;

let priceCache = { tickersKey: null, data: null, fetchedAt: 0 };

// Manuelle Vorrangliste fuer mehrdeutige Ticker (mehrere Coins teilen sich denselben
// Symbolnamen bei CoinGecko, z.B. "BGB" hat mehrere Treffer) - im Zweifel den
// bekanntermassen groessten/richtigen Coin nehmen statt den alphabetisch ersten.
const OVERRIDES = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', SUI: 'sui', LINK: 'chainlink',
  ONDO: 'ondo-finance', RENDER: 'render-token', USDT: 'tether', AAVE: 'aave',
  XRP: 'ripple', ADA: 'cardano', HBAR: 'hedera-hashgraph', XCN: 'onyxcoin',
  BGB: 'bitget-token', TAO: 'bittensor', HYPE: 'hyperliquid'
};

// coins/list ist ein SEHR grosser, teurer Call (ueber 10.000 Coins) mit eigenem,
// strengerem Limit - wird nur noch als letzter Ausweg fuer unbekannte Ticker
// aufgerufen, nicht mehr standardmaessig bei jedem Preis-Request.
async function ladeCoinListe() {
  if (coinListCache && (Date.now() - coinListFetchedAt) < LIST_TTL_MS) return coinListCache;
  const res = await fetch(BASE + '/coins/list' + apiKeyQuery());
  if (!res.ok) throw new Error('CoinGecko coins/list Fehler: ' + res.status);
  const liste = await res.json();
  const map = new Map();
  for (const c of liste) {
    const t = String(c.symbol || '').toUpperCase();
    if (!map.has(t)) map.set(t, c.id); // erster Treffer (meist der bekannteste/aelteste)
  }
  for (const [ticker, id] of Object.entries(OVERRIDES)) map.set(ticker, id);
  coinListCache = map;
  coinListFetchedAt = Date.now();
  return map;
}

function apiKeyQuery() {
  const key = process.env.COINGECKO_API_KEY;
  return key ? (BASE.includes('?') ? '&' : '?') + 'x_cg_demo_api_key=' + encodeURIComponent(key) : '';
}

// Aufloesung Ticker -> CoinGecko-ID: zuerst die fest hinterlegte Liste (deckt alle
// aktuell gehaltenen Coins ab, kein Netzwerk-Call noetig), nur bei unbekannten
// Tickern faellt es auf die grosse coins/list zurueck.
async function resolveIds(uniqTickers) {
  const idToTicker = new Map();
  const unresolved = [];
  for (const t of uniqTickers) {
    if (OVERRIDES[t]) idToTicker.set(OVERRIDES[t], t);
    else unresolved.push(t);
  }
  if (unresolved.length) {
    const voll = await ladeCoinListe();
    for (const t of unresolved) {
      const id = voll.get(t);
      if (id) idToTicker.set(id, t);
    }
  }
  return idToTicker;
}

// tickers: Array von Tickersymbolen, z.B. ['BTC','SOL','XCN']
// Rueckgabe: { BTC: {last, changePct}, SOL: {...}, ... } - Ticker ohne Treffer fehlen einfach.
async function getPrices(tickers) {
  const uniq = [...new Set(tickers.map(t => String(t).toUpperCase()))].sort();
  const key = uniq.join(',');

  if (priceCache.tickersKey === key && (Date.now() - priceCache.fetchedAt) < MIN_INTERVAL_MS) {
    return priceCache.data;
  }

  const idToTicker = await resolveIds(uniq);
  const ids = [...idToTicker.keys()];

  if (!ids.length) {
    priceCache = { tickersKey: key, data: {}, fetchedAt: Date.now() };
    return {};
  }

  const url = BASE + '/simple/price?ids=' + encodeURIComponent(ids.join(',')) +
    '&vs_currencies=usd&include_24hr_change=true' + apiKeyQuery().replace('?','&');
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error('CoinGecko simple/price Fehler: ' + res.status + ' ' + text.slice(0, 200));
  }
  const json = await res.json();

  const out = {};
  for (const [id, vals] of Object.entries(json)) {
    const ticker = idToTicker.get(id);
    if (!ticker) continue;
    out[ticker] = {
      last: vals.usd,
      changePct: vals.usd_24h_change != null ? vals.usd_24h_change : null
    };
  }
  priceCache = { tickersKey: key, data: out, fetchedAt: Date.now() };
  return out;
}

module.exports = { getPrices };
