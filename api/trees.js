// api/trees.js
import pkg from "pg";
import fs from "fs";
import path from "path";

const { Client } = pkg;

export default async function treesHandler(req, context) {
  try {
    // ✅ Fix URL parsing for Express/Render
    const url = new URL(req.url, `http://${req.headers.host}`);
    const email = url.searchParams.get("email");
    const userId = url.searchParams.get("user_id");

    if (!email && !userId) {
      return new Response(
        JSON.stringify({ error: "missing email or user_id" }),
        { status: 400 }
      );
    }

    // ✅ Load CA file directly from disk
    const caPath = path.join(process.cwd(), "certs", "ca.pem");
    const ca = fs.readFileSync(caPath).toString();

    const client = new Client({
      connectionString: process.env.PG_URL,
      ssl: {
        rejectUnauthorized: true, // enforce validation
        ca, // trust Aiven’s CA
      },
    });

    await client.connect();

    let sql, params;
    if (email) {
      sql = `SELECT tree_code, tree_type, lat, long, area, planted_at
             FROM public.v_user_trees
             WHERE lower(email) = lower($1)
             ORDER BY planted_at NULLS LAST, tree_code`;
      params = [email];
    } else {
      sql = `SELECT tree_code, tree_type, lat, long, area, planted_at
             FROM public.v_user_trees
             WHERE user_id = $1
             ORDER BY planted_at NULLS LAST, tree_code`;
      params = [userId];
    }

    const rs = await client.query(sql, params);
    await client.end();

    return new Response(JSON.stringify({ rows: rs.rows }), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("DB connection failed:", err);
    return new Response(
      JSON.stringify({ error: "db error", details: err.message }),
      { status: 500 }
    );
  }
}
