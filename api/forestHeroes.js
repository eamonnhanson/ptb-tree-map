// api/forestHeroes.js
import { Router } from "express";
import { pool } from "./db.js";

const router = Router();

/**
 * Filters:
 * - ?user_id=42  of  ?email=user@example.com
 * - ?area=Makombeh  en/of  ?type=cashew
 * - ?limit=50
 * Geeft altijd boomvelden terug (lat, long, tree_code, ...).
 */
router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 2000);

  const params = [];
  const where = [
    "u.subscription_type IS NOT NULL",
    "t.lat IS NOT NULL",
    "t.long IS NOT NULL",
  ];

  if (req.query.user_id && /^\d+$/.test(req.query.user_id)) {
    params.push(parseInt(req.query.user_id, 10));
    where.push(`u.id = $${params.length}`);
  }
  if (req.query.email) {
    params.push(req.query.email.trim());
    where.push(`LOWER(u.email) = LOWER($${params.length})`);
  }
  if (req.query.area) {
    params.push(req.query.area.trim());
    where.push(`t.area = $${params.length}`);
  }
  if (req.query.type) {
    params.push(req.query.type.trim());
    where.push(`t.tree_type = $${params.length}`);
  }

  // gebruik expliciet schema als nodig (pas 'public' aan als je een ander schema gebruikt)
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
    FROM public.trees1 t
    JOIN public.users1 u ON u.id = t.user_id
    WHERE ${where.join(" AND ")}
    ORDER BY t.id ASC
    LIMIT ${limit};
  `;

  try {
    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (e) {
    // tijdelijk uitgebreid loggen om oorzaak te vinden
    console.error("ForestHeroes query error:", {
      code: e.code,
      message: e.message,
      detail: e.detail,
      hint: e.hint,
      position: e.position
    });
    return res.status(500).json({ error: "serverfout" });
  }
});

export default router;
