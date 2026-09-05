const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const ledgerBtc = require('../lib/ledgerBtc');
const ledgerEvm = require('../lib/ledgerEvm');
const ledgerSolana = require('../lib/ledgerSolana');
const ledgerSui = require('../lib/ledgerSui');

const COIN_NAMES = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', SUI: 'Sui', LINK: 'Chainlink',
  ONDO: 'Ondo', RENDER: 'Render', JITOSOL: 'Jito Staked SOL',
};

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} fehlt als Environment-Variable`);
  return v;
}

async function getOrCreateLedgerPortfolio() {
  const { rows } = await pool.query("SELECT id FROM portfolios WHERE name = 'Ledger'");
  if (rows.length) return rows[0].id;
  const ins = await pool.query("INSERT INTO portfolios (name) VALUES ('Ledger') RETURNING id");
  return ins.rows[0].id;
}

async function upsertHolding(portfolioId, wallet, chain, ticker, amount) {
  const { rows: existing } = await pool.query(
    `SELECT id FROM portfolio WHERE portfolio_id = $1 AND ticker = $2 AND wallet = $3`,
    [portfolioId, ticker, wallet]
  );
  if (existing.length) {
    await pool.query(`UPDATE portfolio SET amount = $1, updated_at = now() WHERE id = $2`, [amount, existing[0].id]);
    return 'updated';
  }
  await pool.query(
    `INSERT INTO portfolio (portfolio_id, asset, ticker, amount, wallet, chain, notiz)
     VALUES ($1,$2,$3,$4,$5,$6,'Auto-Sync (Ledger, live)')`,
    [portfolioId, COIN_NAMES[ticker] || ticker, ticker, amount, wallet, chain]
  );
  return 'inserted';
}

// Sonderfall auf Wunsch: "Bitcoin Mama" ist schon manuell in Portfolio 2 erfasst
// (mit eigenem Einstandspreis). Statt eine zweite, doppelte Zeile im Ledger-Portfolio
// anzulegen, aktualisieren wir dort nur die Menge live - Einstandspreis/Wallet/Chain
// bleiben unangetastet.
const PORTFOLIO2_BTC_MAMA = { portfolioId: 3, ticker: 'BTC' };

async function updatePortfolio2BtcMama(amount) {
  const { rows } = await pool.query(
    `UPDATE portfolio SET amount = $1, updated_at = now()
     WHERE portfolio_id = $2 AND ticker = $3 RETURNING id`,
    [amount, PORTFOLIO2_BTC_MAMA.portfolioId, PORTFOLIO2_BTC_MAMA.ticker]
  );
  if (!rows.length) throw new Error(`Keine BTC-Zeile in Portfolio ${PORTFOLIO2_BTC_MAMA.portfolioId} gefunden`);
  return 'updated (Portfolio 2)';
}

// Fragt alle konfigurierten Ledger-Konten live ab (Bitcoin per xpub-Scan, Ethereum/
// Arbitrum/Solana/Sui per Adresse) und schreibt die Mengen in die portfolio-Tabelle.
// "Bitcoin Mama" geht nach Portfolio 2 (siehe oben), alles andere ins Portfolio
// "Ledger". Kein Einstandspreis hier (nur Mengen) - der kommt, falls bekannt, separat
// aus der importierten CSV-Analyse.
router.get('/sync-balances', async (req, res) => {
  const results = [];
  const errors = [];
  const portfolioId = await getOrCreateLedgerPortfolio();

  try {
    const amount = await ledgerBtc.getXpubBalanceBtc(must('LEDGER_BTC_XPUB_MAMA'));
    const action = await updatePortfolio2BtcMama(amount);
    results.push({ wallet: 'Bitcoin Mama -> Portfolio 2', ticker: 'BTC', amount, action });
  } catch (e) {
    errors.push({ wallet: 'Bitcoin Mama -> Portfolio 2', error: e.message });
  }

  const jobs = [
    { wallet: 'Ledger BTC 1', chain: 'Bitcoin', run: async () => {
        const amount = await ledgerBtc.getXpubBalanceBtc(must('LEDGER_BTC_XPUB_1'));
        return amount > 0 ? [{ ticker: 'BTC', amount }] : [];
      } },
    { wallet: 'Ledger Ethereum', chain: 'Ethereum', run: () => ledgerEvm.getChainHoldings('ethereum', must('LEDGER_EVM_ADDRESS')) },
    { wallet: 'Ledger Arbitrum', chain: 'Arbitrum', run: () => ledgerEvm.getChainHoldings('arbitrum', must('LEDGER_EVM_ADDRESS')) },
    { wallet: 'Ledger Solana', chain: 'Solana', run: () => ledgerSolana.getChainHoldings(must('LEDGER_SOL_ADDRESS')) },
    { wallet: 'Ledger Sui', chain: 'Sui', run: () => ledgerSui.getChainHoldings(must('LEDGER_SUI_ADDRESS')) },
  ];

  for (const job of jobs) {
    try {
      const holdings = await job.run();
      for (const h of holdings) {
        const action = await upsertHolding(portfolioId, job.wallet, job.chain, h.ticker, h.amount);
        results.push({ wallet: job.wallet, ticker: h.ticker, amount: h.amount, action });
      }
    } catch (e) {
      errors.push({ wallet: job.wallet, error: e.message });
    }
  }

  res.json({ ok: errors.length === 0, portfolioId, synced: results, errors });
});

router.get('/debug-btc', async (req, res) => {
  try {
    const which = req.query.which === '1' ? 'LEDGER_BTC_XPUB_1' : 'LEDGER_BTC_XPUB_MAMA';
    const amount = await ledgerBtc.getXpubBalanceBtc(must(which));
    res.json({ ok: true, amount });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/debug-evm', async (req, res) => {
  try {
    const chain = req.query.chain === 'arbitrum' ? 'arbitrum' : 'ethereum';
    const holdings = await ledgerEvm.getChainHoldings(chain, must('LEDGER_EVM_ADDRESS'));
    res.json({ ok: true, chain, holdings });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/debug-solana', async (req, res) => {
  try {
    const holdings = await ledgerSolana.getChainHoldings(must('LEDGER_SOL_ADDRESS'));
    res.json({ ok: true, holdings });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.get('/debug-sui', async (req, res) => {
  try {
    const holdings = await ledgerSui.getChainHoldings(must('LEDGER_SUI_ADDRESS'));
    res.json({ ok: true, holdings });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
