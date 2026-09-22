const pool = require('../db/pool');

// Tabellen, die statt sofortigem DELETE nur `deleted_at` setzen (siehe Undo-Toast in
// public/app.js). Nach einer Gnadenfrist werden sie hier endgueltig entfernt - so
// bleibt die "Rueckgaengig"-Funktion einfach (kein separater Papierkorb-Bildschirm),
// waechst die DB aber trotzdem nicht endlos mit halb vergessenen Loeschungen.
const WEICH_LOESCHBARE_TABELLEN = ['trades', 'todos', 'portfolio', 'watchlist_signals'];
const GNADENFRIST = '15 minutes';

async function raeumeAlteGeloeschteAuf() {
  for (const tabelle of WEICH_LOESCHBARE_TABELLEN) {
    try {
      await pool.query(`DELETE FROM ${tabelle} WHERE deleted_at < now() - interval '${GNADENFRIST}'`);
    } catch (e) {
      console.error('Aufraeumen (soft delete) fehlgeschlagen fuer', tabelle, ':', e.message);
    }
  }
}

module.exports = { raeumeAlteGeloeschteAuf };
