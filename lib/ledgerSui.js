// Live-Bestand fuer das Sui-Konto auf dem Ledger. Sui hat die oeffentliche JSON-RPC
// (suix_getAllBalances etc.) im Sommer 2026 abgeschaltet - wir nutzen stattdessen den
// oeffentlichen GraphQL-Endpunkt (kein API-Key). address.balances entdeckt automatisch
// ALLE Coin-Typen der Adresse - neue Coins auf derselben Adresse tauchen also
// automatisch auf.

const GRAPHQL = 'https://graphql.mainnet.sui.io/graphql';

async function graphql(query, variables) {
  const res = await fetch(GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Sui-GraphQL-Fehler ${res.status}`);
  const j = await res.json();
  if (j.errors && j.errors.length) throw new Error(`Sui-GraphQL-Fehler: ${j.errors.map(e => e.message).join('; ')}`);
  return j.data;
}

function tickerFromCoinType(coinType) {
  if (coinType === '0x2::sui::SUI') return 'SUI';
  const parts = coinType.split('::');
  return parts[parts.length - 1] || coinType;
}

const decimalsCache = { '0x2::sui::SUI': 9 };
async function getDecimals(coinType) {
  if (decimalsCache[coinType] != null) return decimalsCache[coinType];
  try {
    const data = await graphql(
      `query($type: String!) { coinMetadata(coinType: $type) { decimals } }`,
      { type: coinType }
    );
    const d = data?.coinMetadata?.decimals ?? 9;
    decimalsCache[coinType] = d;
    return d;
  } catch {
    return 9; // Fallback, falls Metadaten-Abfrage scheitert
  }
}

async function getChainHoldings(address) {
  const data = await graphql(
    `query($address: SuiAddress!) {
      address(address: $address) {
        balances {
          nodes { coinType { repr } totalBalance }
        }
      }
    }`,
    { address }
  );
  const nodes = data?.address?.balances?.nodes || [];
  const results = [];
  for (const b of nodes) {
    const total = BigInt(b.totalBalance || '0');
    if (total <= 0n) continue;
    const coinType = b.coinType?.repr || b.coinType;
    const decimals = await getDecimals(coinType);
    const amount = Number(total) / 10 ** decimals;
    results.push({ ticker: tickerFromCoinType(coinType), amount });
  }
  return results;
}

module.exports = { getChainHoldings };
