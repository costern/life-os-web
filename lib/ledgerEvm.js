// Live-Bestand fuer Ethereum- und Arbitrum-Konten auf dem Ledger, ueber oeffentliche
// JSON-RPC-Endpunkte (kein API-Key, keine bekannten Limits fuer diese Nutzung -
// wenige Calls, nur bei manuellem Sync-Klick).
// Wichtig/ehrlich: Anders als bei Bitcoin/Solana/Sui gibt es hier KEINE generische
// Möglichkeit, "alle Tokens einer Adresse" per einfachem RPC-Call zu entdecken. Wir
// fragen deshalb gezielt native ETH + eine feste Liste bekannter Token-Contracts ab.
// Ein komplett neuer ERC-20-Token muesste hier manuell ergaenzt werden.

const RPC = {
  ethereum: 'https://ethereum-rpc.publicnode.com',
  arbitrum: 'https://arbitrum-one-rpc.publicnode.com',
};

// ticker -> { contract, decimals }
const TOKENS = {
  ethereum: {
    LINK: { contract: '0x514910771af9ca656af840dff83e8264ecf986ca', decimals: 18 },
    ONDO: { contract: '0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3', decimals: 18 },
  },
  arbitrum: {},
};

async function rpcCall(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC-Fehler ${res.status} (${method})`);
  const j = await res.json();
  if (j.error) throw new Error(`RPC-Fehler: ${j.error.message || JSON.stringify(j.error)}`);
  return j.result;
}

function hexToBigInt(hex) {
  return BigInt(hex === '0x' ? '0x0' : hex);
}

function toDecimal(bigIntValue, decimals) {
  const s = bigIntValue.toString().padStart(decimals + 1, '0');
  const intPart = s.slice(0, -decimals) || '0';
  const fracPart = s.slice(-decimals);
  return Number(`${intPart}.${fracPart}`);
}

async function getNativeBalance(chain, address) {
  const hex = await rpcCall(RPC[chain], 'eth_getBalance', [address, 'latest']);
  return toDecimal(hexToBigInt(hex), 18);
}

async function getErc20Balance(chain, tokenContract, decimals, ownerAddress) {
  // balanceOf(address) selector 0x70a08231, Adresse als 32-Byte-Wort angehaengt.
  const data = '0x70a08231' + ownerAddress.replace(/^0x/, '').padStart(64, '0');
  const hex = await rpcCall(RPC[chain], 'eth_call', [{ to: tokenContract, data }, 'latest']);
  return toDecimal(hexToBigInt(hex), decimals);
}

// Liefert eine Liste { ticker, amount } fuer natives ETH + bekannte Tokens auf der Chain.
async function getChainHoldings(chain, address) {
  const results = [];
  const nativeBalance = await getNativeBalance(chain, address);
  if (nativeBalance > 0) results.push({ ticker: 'ETH', amount: nativeBalance });

  const tokens = TOKENS[chain] || {};
  for (const [ticker, info] of Object.entries(tokens)) {
    const bal = await getErc20Balance(chain, info.contract, info.decimals, address);
    if (bal > 0) results.push({ ticker, amount: bal });
  }
  return results;
}

module.exports = { getChainHoldings };
