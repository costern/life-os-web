const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

// status: win | be_win | be_loss | lose | no_entry. Kein Status (null) = noch nicht bewertet.
// be_win   = 2R wurden erreicht (SL stand schon auf BE), am Ende trotzdem BE raus.
// be_loss  = 2R nie erreicht, BE-Ausstieg ohne dass das Setup geliefert hat.
// no_entry = kein Einstieg zustande gekommen (z.B. Entry zu hoch), der Kurs ist
//            aber auch nicht mehr runtergekommen - also weder Gewinn noch Verlust.
const STATI = new Set(['win', 'be_win', 'be_loss', 'lose', 'no_entry']);
// triple = 3-facher Boden statt des ueblichen Doppel-Bodens (selten) - fuer die spaetere
// Auswertung, ob das auf kleinen Timeframes eher haeufiger (und damit unbedeutender)
// vorkommt als auf groesseren (ab Tageschart).
const EVENT_TYPEN = new Set(['single', 'double', 'triple']);
// form: bogen (sauber) | bogen_unsauber (Bogen erkennbar, aber z.B. nur eine Kerze
// dazwischen oder Wick unter dem Mittel-Level) | kein_bogen
const FORMEN = new Set(['bogen', 'bogen_unsauber', 'kein_bogen']);
// note = Setup-Qualitaet (bewertet das Signal, nicht den Ausgang des Trades)
const NOTEN = new Set(['A++', 'A+', 'A', 'B']);
const MARKTPHASEN = new Set(['uptrend', 'downtrend', 'ranging']);
const PATTERN = new Set(['valid', 'clean', 'choppy']);
const CANDLES = new Set(['choppy', 'decent', 'gap', 'mini']);
const DIVERGENZEN = new Set(['leicht', 'rsi', 'stark', 'none', 'hidden']);
// pivot_level = trifft das Signal ein bereits bestehendes Pivot-Level exakt (perfekt),
// oder liegt es minimal hoeher/tiefer (nicht_perfekt)?
const PIVOT_LEVEL = new Set(['perfekt', 'nicht_perfekt', 'zu_weit_abweichend']);
// Backtest-Auswertung des theoretischen Trades - separat vom Live-Ergebnis "status".
const ERGEBNIS_DETAIL = new Set(['noch_nicht_bewertet', 'target_erreicht', 'be_2r', 'stop_loss',
  'kein_entry', 'kein_trade_rr', 'setup_invalidiert', 'verlauf_unklar']);
const ZIELMETHODE = new Set(['measured_move', 'ema50', 'doji_level', 'horizontaler_widerstand',
  'rr_3r', 'manuelles_ziel', 'kein_ziel']);
// nachkauf_moeglich: Preis ist vom (z.B. Daily-)Pivot-Level schon so weit weg, dass sich
// kein eigenstaendiger Entry mit sauberem R:R mehr lohnt - realistisch bleibt nur Nachkauf
// auf eine bestehende Position (direkt oder nach minimalem Ruecksetzer). Ob ein Limit
// WEITER UNTEN trotzdem gefuellt worden waere, ist davon unabhaengig - siehe eigenes
// Feld limit_moeglich (Colins Gold-Trade: Nachkauf waere moeglich gewesen, das tiefere
// Limit aber nicht, weil es nur minimal runterging und dann schnell hochzog).
const ENTRY_SIMULATION = new Set(['direkter_entry', 'limit_theoretisch_gefuellt', 'limit_nicht_gefuellt',
  'entry_schlechtes_rr', 'kein_regelkonformer_entry', 'nicht_eindeutig', 'nachkauf_moeglich']);
// laenger_seitwaerts_* ersetzt das alte, zu unspezifische 'laenger_seitwaerts' (Colin:
// sagt nichts darueber aus, WOHIN es nach der Seitwaertsphase ging) - 'laenger_seitwaerts'
// bleibt als Wert weiter gueltig, damit bereits gespeicherte Altsignale nicht ploetzlich
// als ungueltig gelten, ist aber in der Dropdown-Liste im Frontend nicht mehr waehlbar.
// Neu (Colin): 'unter_entry_dann_target' ist in zwei Werte aufgeteilt (ueber Pivot gehalten /
// unter Pivots gehalten); Seitwaerts gibt es nur noch mit Stop-Loss oder mit Target
// ('laenger_seitwaerts_target' ersetzt _hoch/_runter). Die alten Werte bleiben gueltig, damit
// nichts Gespeichertes ungueltig wird, sind im Frontend aber nicht mehr (bzw. nur der erste
// als "alt - bitte zuordnen") waehlbar.
const KURSVERLAUF = new Set(['direkt_target', 'unter_entry_dann_target',
  'unter_entry_ueber_pivot_dann_target', 'unter_entry_unter_pivot_dann_target', '2r_dann_zurueck',
  'direkt_stop', 'laenger_seitwaerts', 'laenger_seitwaerts_stop', 'laenger_seitwaerts_target',
  'laenger_seitwaerts_hoch', 'laenger_seitwaerts_runter', 'entry_nie_erreicht',
  'stop_target_gleiche_kerze', 'sonstiger_verlauf']);
const KEIN_TRADE_GRUND = new Set(['rr_schlecht', 'langer_docht', 'sl_zu_weit', 'ziel_zu_nah',
  'keine_htf_bestaetigung', 'pattern_nicht_sauber', 'divergenz_fehlte', 'sonstiger_grund']);
// strategie: eigene Seite im Dashboard je Setup-Art (siehe db/schema.sql), gleiche Tabelle/Felder.
const STRATEGIEN = new Set(['double_bottom', 'ema50_retest', 'mtf_bottom', 'fvg']);
// boden_typ: nur fuer Bottom-Events - basisboden (lange Seitwaerts-Akkumulation, 1W/1M) vs.
// w_pattern (kompakter, scharfer Doppelboden ueber wenige Kerzen).
const BODEN_TYPEN = new Set(['basisboden', 'w_pattern']);

// Uhrzeit: "HH:MM" bzw. "HH:MM:SS" aus dem Formular, sonst nicht gesetzt
function zeitOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const m = String(v).match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return m ? m[1] + ':' + m[2] : null;
}

// Leerstring aus dem Formular als "nicht gesetzt" behandeln
function orNull(v) { return v === '' || v === undefined ? null : v; }
// regelkonform: Formular schickt '' | 'ja' | 'nein' -> null | true | false
function regelkonformOrNull(v) {
  if (v === 'ja') return true;
  if (v === 'nein') return false;
  return null;
}
// 2=2 TF ABER 12H+1D (Achtung, zaehlt nach Colins Regel nicht als echte MTF-Konfluenz),
// 4=2 TF normal (zwei andere TFs) - siehe WL_MTF_LABEL/wlMtfWarnBadgeHtml in app.js.
function mtfOrNull(v) {
  const n = Number(v);
  return [1, 2, 3, 4].includes(n) ? n : null;
}

// Crypto Fear & Greed Index (alternative.me), komplette Historie seit 2018. Wird fuer die
// optionale Linie ueber dem Bitcoin-Chart UND zum automatischen Eintragen des Index-Werts je
// Signal (Wert des Signal-Tages) genutzt. 6h gecacht; bei Fehlern wird der letzte bekannte
// Stand (oder leer) verwendet.
let fngCache = { at: 0, data: [] };
async function fngHistorie() {
  try {
    if (Date.now() - fngCache.at < 6 * 60 * 60 * 1000 && fngCache.data.length) return fngCache.data;
    const r = await fetch('https://api.alternative.me/fng/?limit=0&format=json');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const data = (j.data || [])
      .map(d => [new Date(Number(d.timestamp) * 1000).toISOString().slice(0, 10), Number(d.value)])
      .filter(d => Number.isFinite(d[1]))
      .sort((a, b) => a[0].localeCompare(b[0]));
    if (data.length) fngCache = { at: Date.now(), data };
  } catch (e) { /* alter Stand bleibt */ }
  return fngCache.data;
}
async function fngMap() { return new Map(await fngHistorie()); }

function rowOut(r, fng) {
  return {
    id: r.id,
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
    label: r.label,
    asset: r.asset,
    tf: r.tf,
    notiz: r.notiz,
    status: r.status,
    eventTyp: r.event_typ,
    mtf: r.mtf === null || r.mtf === undefined ? null : Number(r.mtf),
    multiAsset: !!r.multi_asset,
    form: r.form,
    details: r.details,
    news: r.news,
    tradeId: r.trade_id,
    note: r.note,
    marktphase: r.marktphase,
    pattern: r.pattern,
    candles: r.candles,
    divLokal: r.div_lokal,
    divStruktur: r.div_struktur,
    pivotLevel: r.pivot_level,
    ergebnisDetail: r.ergebnis_detail,
    zielmethode: r.zielmethode,
    entrySimulation: r.entry_simulation,
    kursverlauf: r.kursverlauf,
    keinTradeGrund: r.kein_trade_grund,
    analysiert: !!r.analysiert,
    uhrzeit: r.uhrzeit ? String(r.uhrzeit).slice(0, 5) : null,
    regelkonform: r.regelkonform === null || r.regelkonform === undefined ? null : !!r.regelkonform,
    regelkonformGrund: r.regelkonform_grund,
    levelGebrochenGehalten: !!r.level_gebrochen_gehalten,
    nurBestaetigung: !!r.nur_bestaetigung,
    strategie: r.strategie,
    bodenTyp: r.boden_typ,
    mtfGleichesLevel: r.mtf_gleiches_level === null || r.mtf_gleiches_level === undefined ? null : !!r.mtf_gleiches_level,
    limitMoeglich: r.limit_moeglich === null || r.limit_moeglich === undefined ? null : !!r.limit_moeglich,
    guterSpotKauf: !!r.guter_spot_kauf,
    spotKaufPreis: r.spot_kauf_preis,
    // Wirksamer Wert: von Hand eingetragener Wert (Ueberschreiben) sonst automatisch der Index-Wert
    // des Signal-Tages. fearGreedManuell = nur der handschriftliche Wert (fuer das Eingabefeld).
    fearGreed: r.fear_greed !== null && r.fear_greed !== undefined ? Number(r.fear_greed)
      : (fng && fng.has(r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10))
          ? fng.get(r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)) : null),
    fearGreedManuell: r.fear_greed === null || r.fear_greed === undefined ? null : Number(r.fear_greed)
  };
}

// BTC-Tageskurse der letzten ~150 Tage fuer den Hintergrund-Chart. Die eingebettete Kurs-
// historie im Frontend (BTC_DAILY in public/app.js) endet irgendwann - ohne diese Ergaenzung
// liegen neuere Signale (z.B. ein 50er-EMA-Retest nach dem Ende der Daten) ausserhalb des
// Charts und werden dort gar nicht als Marker gezeichnet. Quelle: oeffentliche Crypto.com-
// Exchange-API (ohne Key), 1h gecacht. Bei Fehlern leere Liste -> Chart bleibt wie bisher.
let btcRecentCache = { at: 0, data: [] };
router.get('/btc-recent', async (req, res) => {
  try {
    if (Date.now() - btcRecentCache.at < 60 * 60 * 1000 && btcRecentCache.data.length) return res.json(btcRecentCache.data);
    const url = 'https://api.crypto.com/exchange/v1/public/get-candlestick?instrument_name=BTC_USDT&timeframe=1D&count=300';
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const kerzen = (j.result && j.result.data) || [];
    const proTag = new Map();
    kerzen.forEach(k => proTag.set(new Date(Number(k.t)).toISOString().slice(0, 10), Number(k.c)));
    const data = [...proTag.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (data.length) btcRecentCache = { at: Date.now(), data };
    res.json(data);
  } catch (e) {
    res.json(btcRecentCache.data || []);
  }
});

router.get('/fng', async (req, res) => { res.json(await fngHistorie()); });

router.get('/', async (req, res) => {
  const { strategie } = req.query;
  const where = ['deleted_at IS NULL'];
  const params = [];
  if (strategie) { params.push(strategie); where.push(`strategie = $${params.length}`); }
  const { rows } = await pool.query(
    `SELECT * FROM watchlist_signals WHERE ${where.join(' AND ')} ORDER BY date ASC, uhrzeit ASC NULLS FIRST, id ASC`,
    params
  );
  const fng = await fngMap();
  res.json(rows.map(r => rowOut(r, fng)));
});

router.post('/', async (req, res) => {
  const b = req.body || {};
  if (!b.date) return res.status(400).json({ error: 'date ist Pflicht' });
  if (!b.asset) return res.status(400).json({ error: 'asset ist Pflicht' });
  const status = STATI.has(b.status) ? b.status : null;
  const strategie = STRATEGIEN.has(b.strategie) ? b.strategie : 'double_bottom';
  const { rows } = await pool.query(
    `INSERT INTO watchlist_signals (date, label, asset, tf, notiz, status, event_typ, mtf, multi_asset, form, details, trade_id, note, marktphase, pattern, candles, div_lokal, div_struktur, pivot_level, ergebnis_detail, zielmethode, entry_simulation, kursverlauf, kein_trade_grund, uhrzeit, regelkonform, regelkonform_grund, level_gebrochen_gehalten, nur_bestaetigung, strategie, boden_typ, mtf_gleiches_level, limit_moeglich, guter_spot_kauf, spot_kauf_preis)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35) RETURNING *`,
    [b.date, b.label || null, b.asset, b.tf || null, b.notiz || null, status,
     EVENT_TYPEN.has(b.eventTyp) ? b.eventTyp : null, mtfOrNull(b.mtf), !!b.multiAsset,
     FORMEN.has(b.form) ? b.form : null, orNull(b.details), orNull(b.tradeId),
     NOTEN.has(b.note) ? b.note : null,
     MARKTPHASEN.has(b.marktphase) ? b.marktphase : null,
     PATTERN.has(b.pattern) ? b.pattern : null,
     CANDLES.has(b.candles) ? b.candles : null,
     DIVERGENZEN.has(b.divLokal) ? b.divLokal : null,
     DIVERGENZEN.has(b.divStruktur) ? b.divStruktur : null,
     PIVOT_LEVEL.has(b.pivotLevel) ? b.pivotLevel : null,
     ERGEBNIS_DETAIL.has(b.ergebnisDetail) ? b.ergebnisDetail : null,
     ZIELMETHODE.has(b.zielmethode) ? b.zielmethode : null,
     ENTRY_SIMULATION.has(b.entrySimulation) ? b.entrySimulation : null,
     KURSVERLAUF.has(b.kursverlauf) ? b.kursverlauf : null,
     KEIN_TRADE_GRUND.has(b.keinTradeGrund) ? b.keinTradeGrund : null,
     zeitOrNull(b.uhrzeit),
     regelkonformOrNull(b.regelkonform), orNull(b.regelkonformGrund), !!b.levelGebrochenGehalten, !!b.nurBestaetigung,
     strategie, BODEN_TYPEN.has(b.bodenTyp) ? b.bodenTyp : null, regelkonformOrNull(b.mtfGleichesLevel),
     regelkonformOrNull(b.limitMoeglich), !!b.guterSpotKauf, orNull(b.spotKaufPreis)]
  );
  res.status(201).json(rowOut(rows[0], await fngMap()));
});

router.patch('/:id', async (req, res) => {
  const id = +req.params.id;
  const b = req.body || {};
  const fields = []; const vals = []; let i = 1;
  for (const [key, col] of [['date','date'],['label','label'],['asset','asset'],['tf','tf'],
                            ['notiz','notiz'],['status','status'],['eventTyp','event_typ'],
                            ['mtf','mtf'],['multiAsset','multi_asset'],['form','form'],['details','details'],
                            ['news','news'],
                            ['tradeId','trade_id'],['note','note'],['marktphase','marktphase'],
                            ['pattern','pattern'],['candles','candles'],
                            ['divLokal','div_lokal'],['divStruktur','div_struktur'],
                            ['pivotLevel','pivot_level'],
                            ['ergebnisDetail','ergebnis_detail'],['zielmethode','zielmethode'],
                            ['entrySimulation','entry_simulation'],['kursverlauf','kursverlauf'],
                            ['keinTradeGrund','kein_trade_grund'],
                            ['analysiert','analysiert'],
                            ['uhrzeit','uhrzeit'],
                            ['regelkonform','regelkonform'],['regelkonformGrund','regelkonform_grund'],
                            ['levelGebrochenGehalten','level_gebrochen_gehalten'],
                            ['nurBestaetigung','nur_bestaetigung'],
                            ['strategie','strategie'],
                            ['bodenTyp','boden_typ'],
                            ['mtfGleichesLevel','mtf_gleiches_level'],
                            ['limitMoeglich','limit_moeglich'],
                            ['guterSpotKauf','guter_spot_kauf'],
                            ['spotKaufPreis','spot_kauf_preis'],
                            ['fearGreed','fear_greed']]) {
    if (b[key] === undefined) continue;
    let wert = b[key];
    if (key === 'status') wert = STATI.has(wert) ? wert : null;
    else if (key === 'note') wert = NOTEN.has(wert) ? wert : null;
    else if (key === 'marktphase') wert = MARKTPHASEN.has(wert) ? wert : null;
    else if (key === 'pattern') wert = PATTERN.has(wert) ? wert : null;
    else if (key === 'candles') wert = CANDLES.has(wert) ? wert : null;
    else if (key === 'divLokal' || key === 'divStruktur') wert = DIVERGENZEN.has(wert) ? wert : null;
    else if (key === 'pivotLevel') wert = PIVOT_LEVEL.has(wert) ? wert : null;
    else if (key === 'ergebnisDetail') wert = ERGEBNIS_DETAIL.has(wert) ? wert : null;
    else if (key === 'zielmethode') wert = ZIELMETHODE.has(wert) ? wert : null;
    else if (key === 'entrySimulation') wert = ENTRY_SIMULATION.has(wert) ? wert : null;
    else if (key === 'kursverlauf') wert = KURSVERLAUF.has(wert) ? wert : null;
    else if (key === 'keinTradeGrund') wert = KEIN_TRADE_GRUND.has(wert) ? wert : null;
    else if (key === 'uhrzeit') wert = zeitOrNull(wert);
    else if (key === 'regelkonform' || key === 'mtfGleichesLevel' || key === 'limitMoeglich') wert = regelkonformOrNull(wert);
    else if (key === 'eventTyp') wert = EVENT_TYPEN.has(wert) ? wert : null;
    else if (key === 'form') wert = FORMEN.has(wert) ? wert : null;
    else if (key === 'mtf') wert = mtfOrNull(wert);
    else if (key === 'fearGreed') { const n = parseInt(wert, 10); wert = Number.isFinite(n) && n >= 0 && n <= 100 ? n : null; }
    else if (key === 'multiAsset' || key === 'analysiert' || key === 'levelGebrochenGehalten' || key === 'nurBestaetigung' || key === 'guterSpotKauf') wert = !!wert;
    else if (key === 'strategie') wert = STRATEGIEN.has(wert) ? wert : 'double_bottom';
    else if (key === 'bodenTyp') wert = BODEN_TYPEN.has(wert) ? wert : null;
    else wert = orNull(wert);
    fields.push(`${col} = $${i++}`); vals.push(wert);
  }
  if (!fields.length) return res.status(400).json({ error: 'nichts zu ändern' });
  fields.push(`updated_at = now()`);
  vals.push(id);
  const { rows } = await pool.query(`UPDATE watchlist_signals SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
  if (!rows.length) return res.status(404).json({ error: 'Signal nicht gefunden' });
  res.json(rowOut(rows[0], await fngMap()));
});

// Bottom-Events-Screenshots: gleiches Prinzip wie beim Trading-Log (routes/trades.js) -
// Colin legt eigene TradingView-Screenshots zu einem Signal ab, Bilder liegen als bytea
// in der DB (Render hat kein persistentes Dateisystem).
const ERLAUBTE_BILDTYPEN = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

router.get('/:id/screenshots', async (req, res) => {
  const id = +req.params.id;
  const { rows } = await pool.query(
    'SELECT id, content_type, uploaded_at FROM watchlist_screenshots WHERE signal_id=$1 AND deleted_at IS NULL ORDER BY sort_order ASC NULLS LAST, uploaded_at ASC, id ASC',
    [id]
  );
  res.json(rows.map(r => ({ id: r.id, contentType: r.content_type, uploadedAt: r.uploaded_at })));
});

router.post('/:id/screenshots', async (req, res) => {
  const id = +req.params.id;
  const { imageBase64 } = req.body || {};
  const match = /^data:([^;]+);base64,(.+)$/.exec(String(imageBase64 || ''));
  if (!match) return res.status(400).json({ error: 'imageBase64 fehlt oder ungueltig' });
  const contentType = match[1];
  if (!ERLAUBTE_BILDTYPEN.has(contentType)) return res.status(400).json({ error: 'Bildtyp nicht erlaubt: ' + contentType });
  const buffer = Buffer.from(match[2], 'base64');
  const { rows } = await pool.query(
    `INSERT INTO watchlist_screenshots (signal_id, content_type, image_data) VALUES ($1,$2,$3)
     RETURNING id, content_type, uploaded_at`,
    [id, contentType, buffer]
  );
  const r = rows[0];
  res.status(201).json({ id: r.id, contentType: r.content_type, uploadedAt: r.uploaded_at });
});

// Drag&Drop-Umsortierung, analog zu routes/trades.js.
router.patch('/:id/screenshots/reorder', async (req, res) => {
  const id = +req.params.id;
  const order = Array.isArray(req.body && req.body.order) ? req.body.order.map(Number).filter(Number.isFinite) : [];
  if (!order.length) return res.status(400).json({ error: 'order fehlt oder leer' });
  await pool.query(
    `UPDATE watchlist_screenshots t SET sort_order = v.ord
     FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS ord) v
     WHERE t.id = v.id AND t.signal_id = $3`,
    [order, order.map((_, i) => i), id]
  );
  res.json({ ok: true });
});

router.get('/:id/screenshots/:sid/image', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT content_type, image_data FROM watchlist_screenshots WHERE id=$1 AND signal_id=$2 AND deleted_at IS NULL',
    [+req.params.sid, +req.params.id]
  );
  if (!rows.length) return res.status(404).end();
  res.set('Content-Type', rows[0].content_type);
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(rows[0].image_data);
});

// Weiches Loeschen statt sofort endgueltig, damit der "Rueckgaengig"-Toast im Frontend
// funktioniert - siehe lib/softDelete.js fuers spaetere endgueltige Aufraeumen.
router.delete('/:id/screenshots/:sid', async (req, res) => {
  const { rowCount } = await pool.query(
    'UPDATE watchlist_screenshots SET deleted_at = now() WHERE id=$1 AND signal_id=$2 AND deleted_at IS NULL',
    [+req.params.sid, +req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Screenshot nicht gefunden' });
  res.json({ ok: true });
});

router.post('/:id/screenshots/:sid/restore', async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE watchlist_screenshots SET deleted_at = NULL WHERE id=$1 AND signal_id=$2 AND deleted_at IS NOT NULL RETURNING id, content_type, uploaded_at',
    [+req.params.sid, +req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'nichts zum Wiederherstellen (evtl. Frist abgelaufen)' });
  const r = rows[0];
  res.json({ id: r.id, contentType: r.content_type, uploadedAt: r.uploaded_at });
});

router.delete('/:id', async (req, res) => {
  const id = +req.params.id;
  const { rows } = await pool.query('UPDATE watchlist_signals SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id', [id]);
  if (!rows.length) return res.status(404).json({ error: 'Signal nicht gefunden' });
  res.json({ ok: true, id });
});

router.post('/:id/restore', async (req, res) => {
  const id = +req.params.id;
  const { rows } = await pool.query('UPDATE watchlist_signals SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *', [id]);
  if (!rows.length) return res.status(404).json({ error: 'nichts zum Wiederherstellen (evtl. Frist abgelaufen)' });
  res.json(rowOut(rows[0], await fngMap()));
});

module.exports = router;
