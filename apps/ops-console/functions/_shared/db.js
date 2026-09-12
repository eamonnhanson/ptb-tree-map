import pg from "pg";

const { Pool } = pg;
let pool;
let treePool;

function createPool(connectionString, caBase64, applicationName) {
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  return new Pool({
    connectionString,
    ssl: caBase64 ? { ca: Buffer.from(caBase64, "base64").toString("utf8"), rejectUnauthorized: true } : undefined,
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    statement_timeout: 8000,
    application_name: applicationName
  });
}

export function getPool() {
  if (!pool) pool = createPool(
    process.env.OPS_CONSOLE_DATABASE_URL,
    process.env.OPS_CONSOLE_DATABASE_CA_BASE64,
    "ketso-ops-console-monitoring-read-only"
  );
  return pool;
}

export function getTreePool() {
  if (!treePool) treePool = createPool(
    process.env.OPS_CONSOLE_TREE_DATABASE_URL,
    process.env.OPS_CONSOLE_TREE_DATABASE_CA_BASE64 || process.env.OPS_CONSOLE_DATABASE_CA_BASE64,
    "ketso-ops-console-tree-map-read-only"
  );
  return treePool;
}

async function readFrom(poolForQuery, query, values = []) {
  const client = await poolForQuery().connect();
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

export async function read(query, values = []) {
  return readFrom(getPool, query, values);
}

export async function readTrees(query, values = []) {
  return readFrom(getTreePool, query, values);
}

export function resetPoolForTests() {
  pool = undefined;
  treePool = undefined;
}
