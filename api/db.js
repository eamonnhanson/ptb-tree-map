// api/db.js
import pkg from "pg";
const { Pool } = pkg;

const { DATABASE_URL, NODE_ENV } = process.env;

if (!DATABASE_URL) {
  console.error("DATABASE_URL ontbreekt. Stel deze in op Render.");
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// optioneel: simpele self-test op startup
pool.connect()
  .then(c => c.release())
  .then(() => console.log("✅ DB pool ready"))
  .catch(err => console.error("❌ DB connect error:", err));
