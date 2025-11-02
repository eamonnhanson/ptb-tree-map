// api/forestHeroes.js
import { Router } from "express";
import pkg from "pg";
const { Pool } = pkg;

// zelfde DB-config als je andere handlers gebruiken
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const router = Router();

/**
 * Bomen van users met een abonnement.
 * Optionele filters: ?limit=200&area=Makombeh&type=cashew
 */
router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "500", 10) || 500, 2000);
  const params = [];
  const where = [
    "u.subscription_type IS NOT NULL",
    "t.lat IS NOT NULL",
    "t.long IS NOT NULL",
  ];

  if (req.query.area) {
    params.push(req.query.area);
    where.push(`t.area = $${params.length}`);
  }
  if (req.query.type) {
    params.push(req.query.type);
    where.push(`t.tree_type = $${params.length}`);
  }

  const sql = `
    SELECT
      t.id,
      t.lat,
      t.long,
      t.tree_code,
      t.tree_type,
      t.tree_name,
      t.planted_date,
      t.area,
      u.id   AS user_id,
      u.email
    FROM trees1 t
    JOIN users1 u ON u.id = t.user_id
    WHERE ${where.join(" AND ")}
    ORDER BY t.id ASC
    LIMIT ${limit};
  `;

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("ForestHeroes fout:", e);
    res.status(500).json({ error: "serverfout" });
  }
});

export default router;
