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

    // ✅ Load CA file directly from disk
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
      sql = `
        SELECT tree_code, tree_type, lat, long, area, planted_date
        FROM public.v_user_trees
        WHERE lower(email) = lower($1)
        ORDER BY planted_date NULLS LAST, tree_code
      `;
      params = [email];
    } else {
      sql = `
        SELECT tree_code, tree_type, lat, long, area, planted_date
        FROM public.v_user_trees
        WHERE user_id = $1
        ORDER BY planted_date NULLS LAST, tree_code
      `;
      params = [userId];
    }

    const rs = await client.query(sql, params);
    await client.end();

    // ✅ Send JSON directly to client
    res.json(rs.rows);
  } catch (err) {
    console.error("DB connection failed:", err);
    res.status(500).json({ error: "db error", details: err.message });
  }
}
