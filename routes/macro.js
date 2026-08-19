const express = require('express');
const pool = require('../db/pool');
const router = express.Router();

router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM macro_status WHERE id = 1');
  res.json(rows[0] || {});
});

// Von Claude beschrieben (Web-Recherche statt Alpha-Vantage-Tool)
router.put('/', async (req, res) => {
  const b = req.body || {};
  const { rows } = await pool.query(
    `UPDATE macro_status SET ffr=$1, ffr_date=$2, ty=$3, ty_date=$4, inflation=$5, cpi_date=$6,
       real_rate=$7, note=$8, updated_at=now() WHERE id=1 RETURNING *`,
    [b.ffr ?? null, b.ffrDate ?? null, b.ty ?? null, b.tyDate ?? null,
     b.inflation ?? null, b.cpiDate ?? null, b.realRate ?? null, b.note ?? null]
  );
  res.json(rows[0]);
});

module.exports = router;
