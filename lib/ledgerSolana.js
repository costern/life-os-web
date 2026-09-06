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

// Historie-Rekonstruktion: listet alle Signaturen seit einem Datum (fuer die
// Untersuchung von Aktivitaet, die Ledger Live selbst nicht anzeigt, z.B. Swaps ueber
// Drittanbieter-DEXen wie Jupiter).
async function listSignaturesSince(address, sinceIso) {
  const sinceSec = Math.floor(new Date(sinceIso).getTime() / 1000);
  const all = [];
  let before = undefined;
  for (let i = 0; i < 30; i++) {
    const params = [address, { limit: 1000 }];
    if (before) params[1].before = before;
    const result = await rpcCall('getSignaturesForAddress', params);
    if (!result || !result.length) break;
    let stop = false;
    for (const entry of result) {
      if (entry.blockTime && entry.blockTime < sinceSec) { stop = true; break; }
      all.push(entry);
    }
    if (stop || result.length < 1000) break;
    before = result[result.length - 1].signature;
  }
  return all;
}

// Holt Transaktionsdetails fuer eine Liste von Signaturen und extrahiert Netto-
// Bilanzaenderungen (nativ SOL + SPL-Token) fuer die angegebene Adresse.
async function getBalanceChanges(address, signatures) {
  const changes = [];
  for (const sig of signatures) {
    let tx;
    try {
      tx = await rpcCall('getTransaction', [sig.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]);
    } catch (e) {
      changes.push({ signature: sig.signature, blockTime: sig.blockTime, error: e.message });
      continue;
    }
    if (!tx || !tx.meta) { changes.push({ signature: sig.signature, error: 'keine tx/meta zurueckgegeben' }); continue; }
    // Statische Keys + ueber Address Lookup Tables aufgeloeste Keys (versionierte TX)
    const staticKeys = (tx.transaction.message.accountKeys || []).map(k => (typeof k === 'string' ? k : k.pubkey));
    const loadedWritable = (tx.meta.loadedAddresses && tx.meta.loadedAddresses.writable) || [];
    const loadedReadonly = (tx.meta.loadedAddresses && tx.meta.loadedAddresses.readonly) || [];
    const keys = staticKeys.concat(loadedWritable, loadedReadonly);
    const idx = keys.indexOf(address);
    let solDelta = 0;
    if (idx >= 0 && tx.meta.preBalances && tx.meta.postBalances && idx < tx.meta.preBalances.length) {
      solDelta = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / 1e9;
    }
    const tokenDeltas = [];
    const pre = tx.meta.preTokenBalances || [];
    const post = tx.meta.postTokenBalances || [];
    const byKey = {};
    for (const b of pre) {
      if (b.owner !== address) continue;
      byKey[b.mint] = byKey[b.mint] || { pre: 0, post: 0 };
      byKey[b.mint].pre += Number(b.uiTokenAmount.uiAmount || 0);
    }
    for (const b of post) {
      if (b.owner !== address) continue;
      byKey[b.mint] = byKey[b.mint] || { pre: 0, post: 0 };
      byKey[b.mint].post += Number(b.uiTokenAmount.uiAmount || 0);
    }
    for (const [mint, v] of Object.entries(byKey)) {
      const delta = v.post - v.pre;
      if (Math.abs(delta) > 1e-9) tokenDeltas.push({ mint, delta });
    }
    changes.push({
      signature: sig.signature,
      blockTime: sig.blockTime,
      date: sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : null,
      addressFoundInKeys: idx >= 0,
      solDelta,
      tokenDeltas,
      fee: tx.meta.fee ? tx.meta.fee / 1e9 : null,
    });
  }
  return changes;
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

module.exports = { getChainHoldings, listSignaturesSince, getBalanceChanges };
