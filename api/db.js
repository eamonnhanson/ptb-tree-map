// api/db.js
import pkg from "pg";
const { Pool } = pkg;

const { DATABASE_URL, NODE_ENV } = process.env;

// basisvalidatie
if (!DATABASE_URL) {
  console.error("[DB] DATABASE_URL ontbreekt. Zet deze in Render → Environment.");
  // gooi een harde fout, anders blijf je vage serverfouten krijgen
  throw new Error("DATABASE_URL is not set");
}

// poolconfig
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  // stabielere connecties in productie
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

// log bij start
try {
  const u = new URL(DATABASE_URL);
  console.log("[DB] host:", u.hostname, "db:", u.pathname.slice(1), "ssl:", NODE_ENV === "production");
} catch {
  console.warn("[DB] kon DATABASE_URL niet parsen voor logging");
}

// optioneel: zet schema expliciet, voorkomt search_path issues
pool.on("connect", (client) => {
  // vervang 'public' als jouw tabellen in een ander schema staan
  client.query("SET search_path TO public").catch(() => {});
});

// nette foutlogs uit de pool
pool.on("error", (err) => {
  console.error("[DB] pool error:", {
    code: err.code,
    message: err.message,
    detail: err.detail,
    errno: err.errno,
    address: err.address,
    port: err.port,
  });
});

// handige helper voor uniforme queries en foutmelding
export async function q(sql, params) {
  try {
    return await pool.query(sql, params);
  } catch (e) {
    console.error("[DB] query error:", {
      code: e.code,
      message: e.message,
      detail: e.detail,
      position: e.position,
    });
    throw e;
  }
}

// snelle zelftest bij boot (blijft non-blocking)
(async () => {
  try {
    const r = await pool.query("SELECT now() as now");
    console.log("[DB] ready at", r.rows[0].now);
  } catch (e) {
    console.error("[DB] initial connect failed:", e.code, e.message);
  }
})();
