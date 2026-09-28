const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM cycle_status WHERE id = 1');
  res.json(rows[0] || {});
});

// Von Claude beschrieben (Web-Recherche + Einordnung, kein automatischer Datenfeed).
router.put('/', async (req, res) => {
  const b = req.body || {};
  const { rows } = await pool.query(
    `UPDATE cycle_status SET
       phase=$1, phase_progress=$2, quadrant=$3, headline=$4, note=$5, updated_at=now()
     WHERE id=1 RETURNING *`,
    [b.phase ?? null, b.phaseProgress ?? null, b.quadrant ?? null, b.headline ?? null, b.note ?? null]
  );
  res.json(rows[0]);
});

module.exports = router;
