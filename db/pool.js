const { Pool } = require('pg');

// Neon und Render verlangen beide SSL. Neon liefert sslmode/channel_binding
// bereits in der URL mit; der pg-Client braucht trotzdem ein ssl-Objekt.
const url = process.env.DATABASE_URL || '';
const brauchtSsl = /render\.com|neon\.tech|sslmode=require/.test(url);

const pool = new Pool({
  connectionString: url,
  ssl: brauchtSsl ? { rejectUnauthorized: false } : undefined,
  // Klein halten: die Gratis-Stufen mögen keine vielen offenen Verbindungen,
  // und die Datenbank soll bei Nichtnutzung schlafen gehen dürfen.
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000
});

pool.on('error', err => console.error('Unerwarteter DB-Pool-Fehler:', err.message));

module.exports = pool;
