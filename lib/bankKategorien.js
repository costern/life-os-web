// Revolut-Kontoauszug (consolidated statement, CSV) einlesen + Umsaetze kategorisieren.
const crypto = require('crypto');

// kind: einnahme | ausgabe | transfer (eigene Umbuchungen/Sparen, zaehlt nicht als Ausgabe/Einnahme)
//       | unklar (noch nicht zugeordnet, nicht in den Summen)
const KATEGORIEN = {
  'Gehalt': 'einnahme', 'Erstattungen & Steuern': 'einnahme', 'Sonstige Einnahmen': 'einnahme',
  'Lebensmittel': 'ausgabe', 'Essen & Kantine': 'ausgabe', 'Tanken & Auto': 'ausgabe',
  'Versicherung': 'ausgabe', 'Abos & Software': 'ausgabe', 'Online-Shopping': 'ausgabe',
  'Miete': 'ausgabe', 'Haushalt & Wohnen': 'ausgabe', 'Gesundheit': 'ausgabe', 'Freizeit': 'ausgabe',
  'Körperpflege': 'ausgabe', 'Weiterbildung': 'ausgabe', 'Reisen': 'ausgabe', 'Familie': 'ausgabe',
  'Behörden & Steuern': 'ausgabe', 'Bargeld': 'ausgabe', 'Gebühren': 'ausgabe', 'PayPal': 'ausgabe',
  'Sonstiges': 'ausgabe',
  'Sparen (Tagesgeld)': 'transfer', 'Eigene Umbuchung': 'transfer', 'Krypto-Einzahlung': 'transfer',
  'Unklar': 'unklar'
};

// Reihenfolge wichtig: erster Treffer gewinnt. [Regex auf Beschreibung (klein), Kategorie, nur bei Vorzeichen]
const REGELN = [
  [/^(an|von) eur tagesgeld/, 'Sparen (Tagesgeld)'],
  [/umgetauscht|colin (l |ludwig )?stockert|stockert colin|^to colin/, 'Eigene Umbuchung'],
  [/knds/, 'Gehalt'],
  [/finanzamt/, 'Erstattungen & Steuern', '+'],
  [/harmoniie/, 'Krypto-Einzahlung'],
  [/drivers inn/, 'Tanken & Auto'],
  [/christian manfred stockert|coralie/, 'Familie'],
  [/aldi|edeka|rewe|lidl|penny|netto|kaufland/, 'Lebensmittel'],
  [/eurest|mcdonald|burger|döner|doner|grillhaus|backwaren|bäckerei|restaurant|cafe|café|pizza|kfc|starbucks/, 'Essen & Kantine'],
  [/agip|aral|shell|esso|tankstelle|parken|vewag|parkhaus|jet /, 'Tanken & Auto'],
  [/debeka|janitos|versicherung/, 'Versicherung'],
  [/spotify|notion|claude|norton|itunes|apple|rtl interactive|medium|netflix|openai|google/, 'Abos & Software'],
  [/web3 universe/, 'Weiterbildung'],
  [/amazon/, 'Online-Shopping'],
  [/liebherr|hagebau|müller|ikea|obi|bauhaus|dm /, 'Haushalt & Wohnen'],
  [/apotheke|physiotherapie|spine art|arzt|praxis/, 'Gesundheit'],
  [/bowling|eventsports|kino|cinema|karl rieder/, 'Freizeit'],
  [/cut point|friseur|barber/, 'Körperpflege'],
  [/airalo|booking|airbnb|lufthansa|ryanair|bahn/, 'Reisen'],
  [/polizeiverwaltung|bundesbank|kist|elkb|stadt|finanzamt|bußgeld/, 'Behörden & Steuern'],
  [/bargeld|geldautomat/, 'Bargeld'],
  [/kartenlieferung|gebühr/, 'Gebühren'],
  [/paypal/, 'PayPal']
];

function kategorisieren(beschreibung, betrag, bankKat) {
  const b = String(beschreibung || '').toLowerCase();
  const neg = Number(betrag) < 0;
  // 250 EUR an Familie = Miete (daheim)
  if (neg && Math.abs(Number(betrag)) === 250 && /christian manfred stockert|coralie/.test(b)) return 'Miete';
  for (const [re, kat, vz] of REGELN) {
    if (!re.test(b)) continue;
    if (vz === '+' && neg) continue;
    // Einnahmen von PayPal/Amazon u.a. nicht als Ausgabe-Kategorie fuehren
    if (!neg && KATEGORIEN[kat] === 'ausgabe') return 'Sonstige Einnahmen';
    return kat;
  }
  if (/geldautomat/i.test(bankKat || '')) return 'Bargeld';
  return neg ? 'Sonstiges' : 'Sonstige Einnahmen';
}

// ---- CSV ----
function csvZeilen(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const zahl = s => {
  const t = String(s || '').replace(/[€$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
};
const isoDatum = s => { const m = String(s).match(/^(\d\d)\.(\d\d)\.(\d{4})$/); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };

// Liest den Revolut-"consolidated statement" und liefert alle Transaktionszeilen der Girokonten.
function parseRevolut(text) {
  const rows = csvZeilen(text);
  const out = [];
  let konto = null, inTx = false, betragSpalte = 3;
  for (const r of rows) {
    const c0 = (r[0] || '').trim();
    if (/\((EUR|USD)\)$/.test(c0) && !r[1]) { konto = c0; inTx = false; continue; }
    if (c0 === 'Savings Accounts Transaction Statements') { konto = null; inTx = false; continue; }
    if (c0 === 'Datum' && (r[1] || '') === 'Beschreibung') {
      inTx = /Geld ein-\/ausgezahlt/.test(r[3] || '') && konto && !/Erspartes/.test(konto);
      // Fremdwaehrungskonto: Betrag steht doppelt (Fremdwaehrung, EUR) - dann EUR-Spalte nehmen
      betragSpalte = (r[4] || '') === 'Geld ein-/ausgezahlt' ? 4 : 3;
      continue;
    }
    if (!inTx) continue;
    const d = isoDatum(c0);
    if (!d) continue;
    const guthabenSpalte = betragSpalte === 4 ? 6 : 4;
    out.push({
      datum: d, beschreibung: (r[1] || '').trim(), bankKategorie: (r[2] || '').trim(),
      betrag: zahl(r[betragSpalte]), konto, guthaben: (r[guthabenSpalte] || '').trim()
    });
  }
  return out;
}
const hashFuer = t => crypto.createHash('md5')
  .update([t.datum, t.beschreibung, t.betrag.toFixed(2), t.konto, t.guthaben].join('|')).digest('hex');

module.exports = { KATEGORIEN, kategorisieren, parseRevolut, hashFuer };
