// api/trees.js
import pkg from "pg";
const { Client } = pkg;

export default async function treesHandler(req, context) {
  try {
    const client = new Client({
      connectionString: process.env.PG_URL,
      ssl: {
        rejectUnauthorized: false,  // <— skip CA verification
      },
    });

    await client.connect();
    const result = await client.query("SELECT 1 as test");
    await client.end();

    return new Response(
      JSON.stringify({ ok: true, db: result.rows }),
      {
        headers: { "content-type": "application/json" },
      }
    );
  } catch (err) {
    console.error("DB connection failed:", err);
    return new Response(
      JSON.stringify({ error: "db error", details: err.message }),
      { status: 500 }
    );
  }
}
