// Live-Bestand fuer Bitcoin-Konten auf dem Ledger, ueber den (oeffentlichen) xpub.
// Kein Private Key noetig. Wir leiten selbst alle Native-Segwit-Adressen (BIP84,
// m/84'/0'/account'/chain/index) aus dem Account-xpub ab und fragen pro Adresse den
// Kontostand bei der oeffentlichen Blockstream-Esplora-API ab (keine Rate-Limits im
// Sinne von API-Keys, aber wir scannen bewusst nur bis zur Standard-Gap-Limit von 20
// unbenutzten Adressen in Folge, pro Chain (0=Empfang, 1=Wechselgeld), damit das nicht
// ausufert).
const { HDKey } = require('@scure/bip32');
const { ripemd160 } = require('@noble/hashes/ripemd160');
const { sha256 } = require('@noble/hashes/sha256');
const { bech32 } = require('bech32');

const ESPLORA = 'https://blockstream.info/api';
const GAP_LIMIT = 20;

function p2wpkhAddress(pubkeyBytes) {
  const h160 = ripemd160(sha256(pubkeyBytes));
  const words = bech32.toWords(h160);
  words.unshift(0); // witness version 0
  return bech32.encode('bc', words);
}

async function addressInfo(address) {
  const res = await fetch(`${ESPLORA}/address/${address}`);
  if (!res.ok) throw new Error(`Esplora-Fehler ${res.status} fuer ${address}`);
  const j = await res.json();
  const funded = (j.chain_stats?.funded_txo_sum || 0) + (j.mempool_stats?.funded_txo_sum || 0);
  const spent = (j.chain_stats?.spent_txo_sum || 0) + (j.mempool_stats?.spent_txo_sum || 0);
  const txCount = (j.chain_stats?.tx_count || 0) + (j.mempool_stats?.tx_count || 0);
  return { balanceSat: funded - spent, everUsed: txCount > 0 };
}

// Scannt eine Ableitungs-Chain (0=Empfang, 1=Wechselgeld) bis zur Gap-Limit und
// summiert alle gefundenen Betraege.
async function scanChain(accountKey, chain) {
  let totalSat = 0;
  let gap = 0;
  let index = 0;
  while (gap < GAP_LIMIT) {
    const child = accountKey.deriveChild(chain).deriveChild(index);
    const address = p2wpkhAddress(child.publicKey);
    const { balanceSat, everUsed } = await addressInfo(address);
    totalSat += balanceSat;
    if (everUsed) { gap = 0; } else { gap++; }
    index++;
  }
  return totalSat;
}

// xpub -> Gesamtbestand in BTC (Empfangs- + Wechselgeld-Adressen zusammen).
async function getXpubBalanceBtc(xpub) {
  const accountKey = HDKey.fromExtendedKey(xpub);
  const [receiveSat, changeSat] = await Promise.all([
    scanChain(accountKey, 0),
    scanChain(accountKey, 1),
  ]);
  return (receiveSat + changeSat) / 1e8;
}

module.exports = { getXpubBalanceBtc, p2wpkhAddress };
