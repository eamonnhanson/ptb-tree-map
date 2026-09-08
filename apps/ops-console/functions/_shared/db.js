import pg from "pg";

const { Pool } = pg;
let pool;

export function getPool() {
  const connectionString = process.env.OPS_CONSOLE_DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!pool) {
    const ca = process.env.OPS_CONSOLE_DATABASE_CA_BASE64;
    pool = new Pool({
      connectionString,
      ssl: ca ? { ca: Buffer.from(ca, "base64").toString("utf8"), rejectUnauthorized: true } : undefined,
      max: 3,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      statement_timeout: 8000,
      application_name: "ketso-ops-console-read-only"
    });
  }
  return pool;
}

export async function read(query, values = []) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN READ ONLY");
    const result = await client.query(query, values);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function resetPoolForTests() {
  pool = undefined;
}
