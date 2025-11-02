// api/forestHeroes.js
import { Router } from "express";
import { pool } from "./db.js";

const router = Router();

router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 2000);

  const params = [];
  const where = ["u.subscription_type IS NOT NULL"]; // alleen deze verplicht

  // optionele filters
  if (req.query.user_id && /^\d+$/.test(req.query.user_id)) {
    params.push(parseInt(req.query.user_id, 10));
    where.push(`u.id = $${params.length}`);
  }
  if (req.query.email) {
    params.push(req.query.email.trim());
    where.push(`LOWER(u.email) = LOWER($${params.length})`);
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
      u.email,
      u.subscription_type
    FROM public.trees1 t
    JOIN public.users1 u ON u.id = t.user_id
    WHERE ${where.join(" AND ")}
    ORDER BY t.id ASC
    LIMIT ${limit};
  `;

  try {
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("ForestHeroes query error:", {
      code: e.code,
      message: e.message,
      detail: e.detail,
      hint: e.hint,
      position: e.position
    });
    res.status(500).json({ error: "serverfout" });
  }
});

export default router;
