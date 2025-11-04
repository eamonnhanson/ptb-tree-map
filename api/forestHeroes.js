// api/forestHeroes.js
import { Router } from "express";
import { pool } from "./db.js";

const router = Router();

router.get("/", async (req, res) => {
  // hogere default en ruime cap
  const limit = Math.min(parseInt(req.query.limit || "500", 10) || 500, 10000);
  const afterId = req.query.after_id ? parseInt(req.query.after_id, 10) : null;

  const params = [];
  const where = ["u.subscription_type IS NOT NULL"];

  // keyset filter
  if (!Number.isNaN(afterId) && afterId > 0) {
    params.push(afterId);
    where.push(`t.id > $${params.length}`);
  }

  // optionele filters
  if (req.query.user_id && /^\d+$/.test(req.query.user_id)) {
    params.push(parseInt(req.query.user_id, 10));
    where.push(`u.id = $${params.length}`);
  }
  if (req.query.email) {
    params.push(req.query.email.trim());
    where.push(`LOWER(u.email) = LOWER($${params.length})`);
  }

  // limit als parameter toevoegen
  params.push(limit);

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
    LIMIT $${params.length};
  `;

  try {
    const { rows } = await pool.query(sql, params);
    const next_after_id = rows.length ? rows[rows.length - 1].id : null;
    res.json({ rows, next_after_id });
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
