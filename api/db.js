// api/db.js
import pkg from "pg";
import { fileURLToPath } from "url";
import path from "path";
const { Pool } = pkg;

const { DATABASE_URL, NODE_ENV, DB_SCHEMA } = process.env;

if (!DATABASE_URL) {
  console.error("[DB] DATABASE_URL ontbreekt. Zet deze in Render → Environment.");
  throw new Error("DATABASE_URL is not set");
}

// kies schema via env of val terug op 'public'
const SCHEMA = (DB_SCHEMA || "public").trim();

export const pool = new Pool({
  connectionString: DATABASE_URL,            // bv: postgres://web_ro:***@...:14296/JE_DATABASE?sslmode=require
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

// log basis
try {
  const u = new URL(DATABASE_URL);
  console.log("[DB] host:", u.hostname, "db:", u.pathname.slice(1), "ssl:", NODE_ENV === "production");
} catch {
  console.warn("[DB] kon DATABASE_URL niet parsen");
}

// op elke connect: schema en paar nuttige settings tonen
pool.on("connect", async (client) => {
  try {
    await client.query(`SET search_path TO ${SCHEMA}`);
    const meta = await client.query(`
      select current_database() as db, current_user as "user", current_schema as schema,
             current_setting('search_path') as search_path
    `);
    const m = meta.rows[0];
    console.log(`[DB] connected db=${m.db} user=${m.user} schema=${m.schema} search_path=${m.search_path}`);
  } catch (e) {
    console.error("[DB] connect hook error:", e.code, e.message);
  }
});

pool.on("error", (err) => {
  console.error("[DB] pool error:", {
    code: err.code, message: err.message, detail: err.detail, errno: err.errno, address: err.address, port: err.port,
  });
});

// uniforme query helper
export async function q(sql, params) {
  try {
    return await pool.query(sql, params);
  } catch (e) {
    console.error("[DB] query error:", { code: e.code, message: e.message, detail: e.detail, position: e.position });
    throw e;
  }
}

// lichte self-test
(async () => {
  try {
    const r = await pool.query("select now() as now");
    console.log("[DB] ready at", r.rows[0].now);
  } catch (e) {
    console.error("[DB] initial connect failed:", e.code, e.message);
  }
})();

// exporteer het schema voor gebruik in queries
export const SCHEMA_NAME = SCHEMA;
