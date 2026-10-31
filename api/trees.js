// api/trees.js
import pkg from "pg";
import fs from "fs";
import path from "path";

const { Client } = pkg;

export default async function treesHandler(req, res) {
  try {
    const email = req.query.email;
    const userId = req.query.user_id;

    if (!email && !userId) {
      return res.status(400).json({ error: "missing email or user_id" });
    }

    const caPath = path.join(process.cwd(), "certs", "ca.pem");
    const ca = fs.readFileSync(caPath, "utf8");

    const client = new Client({
      connectionString: process.env.PG_URL,
      ssl: {
        rejectUnauthorized: true,
        ca,
      },
    });

    await client.connect();

    let sql, params;

    if (email) {
      const demoSchema = await client.query(`
        SELECT
          to_regclass('public.demo_orders') IS NOT NULL AS has_orders,
          to_regclass('public.demo_order_trees') IS NOT NULL AS has_links
      `);
      const demoEnabled = demoSchema.rows[0]?.has_orders && demoSchema.rows[0]?.has_links;

      if (demoEnabled) {
        sql = `
          WITH regular_trees AS (
            SELECT
              v.tree_code,
              v.tree_type,
              v.lat,
              v.long,
              v.area,
              v.planted_date,
              false AS is_demo,
              NULL::timestamptz AS demo_expires_at
            FROM public.v_user_trees v
            WHERE lower(v.email) = lower($1)
          ),
          active_demo_trees AS (
            SELECT
              t.tree_code,
              t.tree_type,
              t.lat,
              t."long" AS long,
              t.area,
              t.planted_date,
              true AS is_demo,
              ord.reserved_until AS demo_expires_at
            FROM public.demo_orders ord
            JOIN public.demo_order_trees link
              ON link.shopify_order_id = ord.shopify_order_id
            JOIN public.trees1 t
              ON t.id = link.tree_id
            WHERE lower(ord.customer_email) = lower($1)
              AND ord.reserved_until > now()
              AND link.released_at IS NULL
          )
          SELECT *
          FROM (
            SELECT * FROM regular_trees
            UNION ALL
            SELECT * FROM active_demo_trees
          ) trees
          ORDER BY planted_date NULLS LAST, tree_code
        `;
      } else {
        sql = `
          SELECT
            tree_code,
            tree_type,
            lat,
            long,
            area,
            planted_date,
            false AS is_demo,
            NULL::timestamptz AS demo_expires_at
          FROM public.v_user_trees
          WHERE lower(email) = lower($1)
          ORDER BY planted_date NULLS LAST, tree_code
        `;
      }
      params = [email];
    } else {
      sql = `
        SELECT
          tree_code,
          tree_type,
          lat,
          long,
          area,
          planted_date,
          false AS is_demo,
          NULL::timestamptz AS demo_expires_at
        FROM public.v_user_trees
        WHERE user_id = $1
        ORDER BY planted_date NULLS LAST, tree_code
      `;
      params = [userId];
    }

    const rs = await client.query(sql, params);
    await client.end();

    res.json(rs.rows);
  } catch (err) {
    console.error("DB connection failed:", err);
    res.status(500).json({ error: "db error", details: err.message });
  }
}
