import pkg from "pg";
const { Pool } = pkg;

const { DATABASE_URL, NODE_ENV } = process.env;

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// korte log zodat je ziet waar hij heen wil
try {
  const u = new URL(DATABASE_URL);
  console.log("DB host:", u.hostname, "DB name:", u.pathname.replace("/",""));
} catch {}
