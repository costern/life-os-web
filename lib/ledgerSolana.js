// Live-Bestand fuer das Solana-Konto auf dem Ledger, ueber den oeffentlichen
// Solana-JSON-RPC-Endpunkt (kein API-Key). Natives SOL + alle SPL-Token-Konten werden
// automatisch entdeckt (getTokenAccountsByOwner) - neue Token auf derselben Adresse
// tauchen also automatisch auf, auch wenn ihr Ticker uns noch nicht bekannt ist.

const RPC = 'https://api.mainnet-beta.solana.com';
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// Bekannte Mint-Adressen -> Ticker. Unbekannte Mints werden trotzdem gemeldet (mit
// gekuerzter Mint-Adresse als Ticker), damit nichts "verschwindet".
const KNOWN_MINTS = {
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'JITOSOL',
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': 'RENDER',
};

async function rpcCall(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Solana-RPC-Fehler ${res.status} (${method})`);
  const j = await res.json();
  if (j.error) throw new Error(`Solana-RPC-Fehler: ${j.error.message || JSON.stringify(j.error)}`);
  return j.result;
}

async function getNativeSolBalance(address) {
  const result = await rpcCall('getBalance', [address]);
  const lamports = result?.value ?? 0;
  return lamports / 1e9;
}

async function getTokenHoldings(address) {
  const holdings = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    const result = await rpcCall('getTokenAccountsByOwner', [
      address,
      { programId },
      { encoding: 'jsonParsed' },
    ]);
    for (const entry of result?.value || []) {
      const info = entry.account?.data?.parsed?.info;
      const amount = info?.tokenAmount?.uiAmount;
      if (!info || !amount || amount <= 0) continue;
      const ticker = KNOWN_MINTS[info.mint] || ('SPL:' + info.mint.slice(0, 4) + '...' + info.mint.slice(-4));
      holdings.push({ ticker, amount, mint: info.mint });
    }
  }
  return holdings;
}

async function getChainHoldings(address) {
  const results = [];
  const sol = await getNativeSolBalance(address);
  if (sol > 0) results.push({ ticker: 'SOL', amount: sol });
  const tokens = await getTokenHoldings(address);
  results.push(...tokens);
  return results;
}

module.exports = { getChainHoldings };
