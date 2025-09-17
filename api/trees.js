// api/trees.js
import { Client } from "pg";

export default async function treesHandler(req, context) {
  try {
    const client = new Client({
      connectionString: process.env.PG_URL,
      ssl: process.env.PGSSLMODE === "no-verify" 
        ? { rejectUnauthorized: false } 
        : true
    });

    await client.connect();

    // 🔍 Test query
    const rs = await client.query("SELECT 1 AS test_value");
    await client.end();

    return new Response(
      JSON.stringify({ success: true, result: rs.rows }),
      {
        headers: { "content-type": "application/json" }
      }
    );
  } catch (e) {
    console.error("DB connection test error:", e);
    return new Response(
      JSON.stringify({ error: "DB connection failed", details: e.message }),
      { status: 500 }
    );
  }
}
