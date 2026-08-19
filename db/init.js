const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('DB-Schema geprüft/angelegt.');
}

module.exports = initDb;
