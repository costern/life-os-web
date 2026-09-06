// Live-Bestand fuer das Solana-Konto auf dem Ledger, ueber den oeffentlichen
// Solana-JSON-RPC-Endpunkt (kein API-Key). Natives SOL + alle SPL-Token-Konten werden
// automatisch entdeckt (getTokenAccountsByOwner) - neue Token auf derselben Adresse
// tauchen also automatisch auf, auch wenn ihr Ticker uns noch nicht bekannt ist.

const RPC = 'https://api.mainnet-beta.solana.com';
const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const STAKE_PROGRAM_ID = 'Stake11111111111111111111111111111111111111';

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

// Delegiertes/gestaktes SOL liegt in eigenen Stake-Accounts (Programm "Stake111...."),
// nicht im normalen Wallet-Guthaben - getBalance() sieht die nicht. Wir suchen alle
// Stake-Accounts, bei denen unsere Adresse als "staker" (Stake Authority) eingetragen
// ist, und summieren deren Kontostand (inkl. bereits aufgelaufener Rewards).
async function getStakedSolBalance(address) {
  const result = await rpcCall('getProgramAccounts', [
    STAKE_PROGRAM_ID,
    {
      filters: [
        { dataSize: 200 },
        { memcmp: { offset: 12, bytes: address } },
      ],
      encoding: 'base64',
    },
  ]);
  let totalLamports = 0;
  for (const entry of result || []) {
    totalLamports += entry.account?.lamports || 0;
  }
  return totalLamports / 1e9;
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
  const [available, staked] = await Promise.all([
    getNativeSolBalance(address),
    getStakedSolBalance(address),
  ]);
  const sol = available + staked;
  if (sol > 0) results.push({ ticker: 'SOL', amount: sol });
  const tokens = await getTokenHoldings(address);
  results.push(...tokens);
  return results;
}

module.exports = { getChainHoldings };
