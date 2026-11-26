// Revolut-Kontoauszug (consolidated statement, CSV) einlesen + Umsaetze kategorisieren.
const crypto = require('crypto');

// kind: einnahme | ausgabe | transfer (eigene Umbuchungen/Sparen, zaehlt nicht als Ausgabe/Einnahme)
//       | unklar (noch nicht zugeordnet, nicht in den Summen)
const KATEGORIEN = {
  'Gehalt': 'einnahme', 'Erstattungen & Steuern': 'einnahme', 'Sonstige Einnahmen': 'einnahme',
  'Lebensmittel': 'ausgabe', 'Essen & Kantine': 'ausgabe', 'Auto: Tanken': 'ausgabe', 'Auto: Reparatur & Versicherung': 'ausgabe', 'Auto: Parken & Maut': 'ausgabe',
  'Versicherung': 'ausgabe', 'Abos & Software': 'ausgabe', 'Online-Shopping': 'ausgabe',
  'Miete': 'ausgabe', 'Haushalt & Wohnen': 'ausgabe', 'Gesundheit': 'ausgabe', 'Freizeit': 'ausgabe',
  'Körperpflege': 'ausgabe', 'Kleidung': 'ausgabe', 'Weiterbildung': 'ausgabe', 'Reisen': 'ausgabe', 'Familie': 'ausgabe',
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
  [/drivers inn|allguth|^eni\b|agip|aral|shell|esso|tankstelle|jet /, 'Auto: Tanken'],
  [/janitos|kfz|bundesbank filiale regensburg|festimbehrami|festim behrami|werkstatt|autoservice|tüv|dekra/, 'Auto: Reparatur & Versicherung'],
  [/asfinag|autostrada|maut|vignette|parcheg|parken|parkhaus|vewag/, 'Auto: Parken & Maut'],
  [/christian manfred stockert|coralie|chr\.stockert/, 'Familie'],
  [/trade republic/, 'Eigene Umbuchung'],
  [/bergstromleander/, 'Reisen'],
  [/snipes|uniqlo|zalando|h&m|zara|deichmann/, 'Kleidung'],
  [/maren23ob/, 'Freizeit'],
  [/backstube|rischart|akakiko|pappafico|do & co|gistr/, 'Essen & Kantine'],
  [/telefonica|blockpit|tradingview/, 'Abos & Software'],
  [/aldi|edeka|rewe|lidl|penny|netto|kaufland/, 'Lebensmittel'],
  [/eurest|mcdonald|burger|döner|doner|grillhaus|backwaren|bäckerei|restaurant|cafe|café|pizza|kfc|starbucks/, 'Essen & Kantine'],
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
// Revolut-Transaktions-Export ("Excel"/CSV aus der App): Art,Produkt,Datum des Beginns,...,Kontostand.
// Nur das Girokonto (Produkt "Giro"/"Current"), stornierte/ausstehende Zeilen ueberspringen.
// Datum = Datum des Beginns (wann gezahlt wurde).
function parseRevolutTransaktionen(rows) {
  const k = rows[0].map(x => x.trim());
  const ix = n => k.findIndex(x => n.includes(x));
  const iArt = ix(['Art', 'Type']), iProd = ix(['Produkt', 'Product']), iStart = ix(['Datum des Beginns', 'Started Date']),
    iBes = ix(['Beschreibung', 'Description']), iBet = ix(['Betrag', 'Amount']), iGeb = ix(['Gebühr', 'Fee']),
    iWae = ix(['Währung', 'Currency']), iSt = ix(['Status', 'State']), iKs = ix(['Kontostand', 'Balance']);
  const out = [];
  for (const r of rows.slice(1)) {
    if (!r[iStart]) continue;
    if (!/^(giro|current)$/i.test((r[iProd] || '').trim())) continue;
    if (!/^(abgeschlossen|completed)$/i.test((r[iSt] || '').trim())) continue;
    const d = String(r[iStart]).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    const wae = (r[iWae] || 'EUR').trim();
    const betrag = Math.round((parseFloat(r[iBet]) - (parseFloat(r[iGeb]) || 0)) * 100) / 100;
    out.push({ datum: d, beschreibung: (r[iBes] || '').trim(), bankKategorie: (r[iArt] || '').trim(),
      betrag, konto: 'Persönliches Konto (' + wae + ')', guthaben: (r[iKs] || '').trim() });
  }
  return out;
}

// UTF-8, das als Latin-1 gelesen wurde ("SÃœD"), reparieren
function umlauteReparieren(text) {
  if (!/Ã[\x80-\xBF]|â€/.test(text)) return text;
  // Windows-1252: Zeichen 0x80-0x9F liegen auf anderen Unicode-Codepunkten (z.B. "œ" = 0x9C)
  const cp = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ';
  const bytes = [];
  for (const ch of text) {
    const c = ch.codePointAt(0), j = cp.indexOf(ch);
    if (c < 0x80 || (c >= 0xA0 && c < 0x100)) bytes.push(c);
    else if (j >= 0) bytes.push(0x80 + j);
    else return text;
  }
  const t = Buffer.from(bytes).toString('utf8');
  return t.includes('\uFFFD') ? text : t;
}

function parseRevolut(text) {
  text = umlauteReparieren(String(text).replace(/^\uFEFF/, ''));
  const rows = csvZeilen(text);
  if (rows.length && /^(Art|Type)$/.test((rows[0][0] || '').trim()) && rows[0].some(x => /Datum des Beginns|Started Date/.test(x)))
    return parseRevolutTransaktionen(rows);
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
