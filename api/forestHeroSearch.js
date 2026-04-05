// api/forestHeroSearch.js
import { pool } from "./db.js";

export default async function forestHeroSearch(req, res) {
  const q = (req.query.q || "").trim();

  if (!q) {
    return res.json([]);
  }

  try {
    const sql = `
      SELECT
        u.id AS user_id,
        t.id AS tree_id,
        u.first_name,
        u.last_name,
        u.subscription_type,
        t.tree_type,
        t.area,
        to_char(t.planted_date, 'YYYY-MM-DD') AS planted_date,
        t.tree_code
      FROM public.users1 u
      JOIN public.trees1 t
        ON t.user_id = u.id
      WHERE
        u.subscription_type IS NOT NULL
        AND (
          LOWER(COALESCE(u.first_name, '')) LIKE LOWER('%' || $1 || '%')
          OR LOWER(COALESCE(u.last_name, '')) LIKE LOWER('%' || $1 || '%')
          OR LOWER(COALESCE(t.tree_type, '')) LIKE LOWER('%' || $1 || '%')
          OR LOWER(COALESCE(t.area, '')) LIKE LOWER('%' || $1 || '%')
          OR LOWER(COALESCE(t.tree_code, '')) LIKE LOWER('%' || $1 || '%')
        )
      ORDER BY
        u.first_name,
        u.last_name,
        t.planted_date DESC NULLS LAST
      LIMIT 20
    `;

    const { rows } = await pool.query(sql, [q]);

    const results = rows.map((row) => ({
      ...row,
      display_label: [
        `${row.first_name || ""} ${row.last_name || ""}`.trim(),
        row.tree_type || "",
        row.area || "",
        row.planted_date || "",
        row.tree_code || ""
        ].filter(Boolean).join(" | ")
    }));

    return res.json(results);
  } catch (e) {
    console.error("forestHeroSearch error:", {
      code: e.code,
      message: e.message,
      detail: e.detail
    });

    return res.status(500).json({
      ok: false,
      error: "Search failed",
      code: e.code || null,
      message: e.message || null
    });
  }
}
