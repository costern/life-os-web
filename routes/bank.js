const express = require('express');
const pool = require('../db/pool');
const { KATEGORIEN, kategorisieren, parseRevolut, hashFuer } = require('../lib/bankKategorien');
const router = express.Router();

// Haendler-Muster fuer eine Beschreibung: ohne fuehrendes "To "/"An "/"Von "/"Zahlung von ",
// klein geschrieben - damit eine Zuordnung fuer alle gleichen Haendler gilt.
function musterVon(beschreibung) {
  return String(beschreibung).toLowerCase().replace(/^(to|an|von|zahlung von)\s+/, '').trim();
}

async function regelnLaden() {
  const { rows } = await pool.query('SELECT muster, kategorie FROM bank_regeln');
  return rows.sort((a, b) => b.muster.length - a.muster.length);
}

function kategorieFuer(r, regeln) {
  if (r.kategorie && KATEGORIEN[r.kategorie]) return r.kategorie;
  const m = musterVon(r.beschreibung);
  const treffer = regeln.find(x => m.includes(x.muster));
  if (treffer && KATEGORIEN[treffer.kategorie]) return treffer.kategorie;
  return kategorisieren(r.beschreibung, r.betrag, r.bank_kategorie);
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM bank_transactions ORDER BY datum DESC, id DESC');
  const regeln = await regelnLaden();
  res.json({
    kategorien: KATEGORIEN,
    umsaetze: rows.map(r => {
      const kat = kategorieFuer(r, regeln);
      return { id: r.id, datum: r.datum instanceof Date ? r.datum.toISOString().slice(0, 10) : String(r.datum).slice(0, 10),
        beschreibung: r.beschreibung, betrag: Number(r.betrag), konto: r.konto,
        kategorie: kat, kind: KATEGORIEN[kat], manuell: !!r.kategorie };
    })
  });
});

// Revolut-Kontoauszug (CSV-Text) importieren. Doppelte Zeilen (gleicher Hash) werden uebersprungen,
// ueberlappende Auszuege sind also unproblematisch.
router.post('/import', async (req, res) => {
  const text = (req.body && req.body.csv) || '';
  const zeilen = parseRevolut(text);
  if (!zeilen.length) return res.status(400).json({ error: 'Keine Umsätze erkannt – ist das der Revolut-Kontoauszug (CSV)?' });
  let neu = 0;
  for (const t of zeilen) {
    const r = await pool.query(
      `INSERT INTO bank_transactions (datum, beschreibung, bank_kategorie, betrag, konto, hash)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (hash) DO NOTHING`,
      [t.datum, t.beschreibung, t.bankKategorie, t.betrag, t.konto, hashFuer(t)]
    );
    neu += r.rowCount;
  }
  res.json({ gelesen: zeilen.length, neu, uebersprungen: zeilen.length - neu });
});

// Kategorie aendern. fuerAlle=true: Regel fuer diesen Haendler anlegen (gilt fuer alle gleichen
// Umsaetze, auch kuenftige Importe) und manuelle Einzelzuordnungen dieses Haendlers zuruecksetzen.
router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const { kategorie, fuerAlle } = req.body || {};
  if (kategorie !== null && !KATEGORIEN[kategorie]) return res.status(400).json({ error: 'Unbekannte Kategorie' });
  const { rows } = await pool.query('SELECT * FROM bank_transactions WHERE id=$1', [id]);
  if (!rows.length) return res.status(404).json({ error: 'nicht gefunden' });
  if (fuerAlle && kategorie) {
    const muster = musterVon(rows[0].beschreibung);
    await pool.query(
      `INSERT INTO bank_regeln (muster, kategorie) VALUES ($1,$2)
       ON CONFLICT (muster) DO UPDATE SET kategorie = EXCLUDED.kategorie`, [muster, kategorie]);
    await pool.query(`UPDATE bank_transactions SET kategorie=NULL WHERE lower(beschreibung) LIKE '%' || $1 || '%'`, [muster]);
  } else {
    await pool.query('UPDATE bank_transactions SET kategorie=$1 WHERE id=$2', [kategorie, id]);
  }
  res.json({ ok: true });
});

module.exports = router;
