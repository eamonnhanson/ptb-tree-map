// api/trees.js
import pkg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Client } = pkg;

// __dirname replacement for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function treesHandler(req, context) {
  try {
    // point to /certs/ca.pem (relative to repo root)
    const caPath = path.join(__dirname, "..", "certs", "ca.pem");
    const caCert = fs.readFileSync(caPath).toString();

    const client = new Client({
      connectionString: process.env.PG_URL,
      ssl: {
        ca: caCert,
        rejectUnauthorized: true,
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
