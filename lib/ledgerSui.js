// Live-Bestand fuer das Sui-Konto auf dem Ledger, ueber den oeffentlichen Sui-
// JSON-RPC-Endpunkt (kein API-Key). suix_getAllBalances entdeckt automatisch ALLE
// Coin-Typen der Adresse - neue Coins auf derselben Adresse tauchen also automatisch
// auf.

const RPC = 'https://fullnode.mainnet.sui.io';

async function rpcCall(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Sui-RPC-Fehler ${res.status} (${method})`);
  const j = await res.json();
  if (j.error) throw new Error(`Sui-RPC-Fehler: ${j.error.message || JSON.stringify(j.error)}`);
  return j.result;
}

function tickerFromCoinType(coinType) {
  if (coinType === '0x2::sui::SUI') return 'SUI';
  const parts = coinType.split('::');
  return parts[parts.length - 1] || coinType;
}

const decimalsCache = {};
async function getDecimals(coinType) {
  if (coinType === '0x2::sui::SUI') return 9;
  if (decimalsCache[coinType] != null) return decimalsCache[coinType];
  try {
    const meta = await rpcCall('suix_getCoinMetadata', [coinType]);
    const d = meta?.decimals ?? 9;
    decimalsCache[coinType] = d;
    return d;
  } catch {
    return 9; // Fallback, falls kein Metadaten-Eintrag existiert
  }
}

async function getChainHoldings(address) {
  const balances = await rpcCall('suix_getAllBalances', [address]);
  const results = [];
  for (const b of balances || []) {
    const total = BigInt(b.totalBalance || '0');
    if (total <= 0n) continue;
    const decimals = await getDecimals(b.coinType);
    const amount = Number(total) / 10 ** decimals;
    results.push({ ticker: tickerFromCoinType(b.coinType), amount });
  }
  return results;
}

module.exports = { getChainHoldings };
