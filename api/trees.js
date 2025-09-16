// api/trees.js
import { Client } from "pg";

export default async function treesHandler(req, context) {
  try {
    // Parse query params
    const url = new URL(req.url, `http://${req.headers.host}`);
    const email = url.searchParams.get("email");
    const userId = url.searchParams.get("user_id");

    if (!email && !userId) {
      return new Response(
        JSON.stringify({ error: "missing email or user_id" }),
        { status: 400 }
      );
    }

    // Create client using PG_URL and PGSSLMODE
    const client = new Client({
      connectionString: process.env.PG_URL,
      ssl: process.env.PGSSLMODE === "no-verify" 
        ? { rejectUnauthorized: false } 
        : true
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

    return new Response(
      JSON.stringify({ rows: rs.rows }),
      {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store"
        }
      }
    );
  } catch (e) {
    console.error("trees.js error:", e);
    return new Response(
      JSON.stringify({ error: "server error" }),
      { status: 500 }
    );
  }
}
