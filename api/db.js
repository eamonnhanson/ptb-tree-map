// api/db.js
import pkg from "pg";
const { Pool } = pkg;

const { DATABASE_URL, NODE_ENV } = process.env;

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// log 1x bij start
pool.connect()
  .then(c => { c.release(); console.log("✅ DB pool ready"); })
  .catch(err => console.error("❌ DB connect error:", err?.code, err?.message));
