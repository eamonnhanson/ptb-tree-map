import pg from "pg";
import { TREE_DATABASE_CA } from "./tree-database-ca.js";

const { Pool } = pg;
let pool;
let treePool;
const TLS_URL_PARAMETERS = ["sslmode", "sslrootcert", "sslcert", "sslkey", "sslnegotiation", "uselibpqcompat"];

function withoutTlsUrlParameters(connectionString) {
  const url = new URL(connectionString);
  const remaining = [...url.searchParams]
    .filter(([parameter]) => !TLS_URL_PARAMETERS.includes(parameter))
    .map(([parameter, value]) => `${encodeURIComponent(parameter)}=${encodeURIComponent(value)}`);
  url.search = remaining.join("&");
  return url.toString();
}

function decodeCa(caBase64) {
  return caBase64 ? Buffer.from(caBase64, "base64").toString("utf8") : undefined;
}

function createPool(connectionString, ca, applicationName) {
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  return new Pool({
    // pg re-parses a connection string after applying this configuration. Strip
    // URL SSL options so they cannot replace the verified CA supplied below.
    connectionString: withoutTlsUrlParameters(connectionString),
    ssl: ca ? { ca, rejectUnauthorized: true } : undefined,
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
    decodeCa(process.env.OPS_CONSOLE_DATABASE_CA_BASE64),
    "ketso-ops-console-monitoring-read-only"
  );
  return pool;
}

export function getTreePool() {
  if (!treePool) treePool = createPool(
    process.env.OPS_CONSOLE_TREE_DATABASE_URL,
    process.env.OPS_CONSOLE_TREE_DATABASE_CA_BASE64
      ? decodeCa(process.env.OPS_CONSOLE_TREE_DATABASE_CA_BASE64)
      : TREE_DATABASE_CA,
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
