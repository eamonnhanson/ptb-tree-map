import { readTrees } from "./_shared/db.js";
import { guardGet, json, unavailable } from "./_shared/http.js";

const ORDER_ID = "17987956932938";
const IDENTITY = "select current_database() as database, current_user as current_user";
const RELATIONS = "select to_regclass('public.trees1') as trees1_relation, to_regclass('public.gift_claims') as gift_claims_relation";
const TREES_COUNT = "select count(*)::int as allocated_count from public.trees1 where order_id::text = $1";
const TREES_GROUPED = "select order_id::text as order_id,count(*)::int as allocated_count,max(coalesce(claimed_at,updated_at,created_at)) as processed_at from public.trees1 where order_id::text = $1 group by order_id";
const CLAIMS_GROUPED = "select order_id::text as order_id,max(number_of_trees)::int as claim_count,max(created_at) as processed_at from public.gift_claims where order_id::text = $1 group by order_id";
const TREES_ANY = "select order_id::text as order_id,count(*)::int as allocated_count,max(coalesce(claimed_at,updated_at,created_at)) as processed_at from public.trees1 where order_id::text = any($1::text[]) group by order_id";
const CLAIMS_ANY = "select order_id::text as order_id,max(number_of_trees)::int as claim_count,max(created_at) as processed_at from public.gift_claims where order_id::text = any($1::text[]) group by order_id";
const safeError = error => ({ status: "error", ...(typeof error?.code === "string" && /^[A-Z0-9_]{1,40}$/i.test(error.code) ? { error_code: error.code } : {}), message: "Tree database query unavailable" });
const address = value => { const url = new URL(value); return { host: url.hostname, port: Number(url.port || 5432) }; };
async function checked(query, sql, values = []) { try { return { status: "ok", rows: (await query(sql, values)).rows || [] }; } catch (error) { return safeError(error); } }

export function createHandler({ query = readTrees, connectionUrl = () => process.env.OPS_CONSOLE_TREE_DATABASE_URL } = {}) {
  return async event => {
    const guard = guardGet(event); if (guard) return guard;
    let connection;
    try { connection = address(connectionUrl()); } catch { return unavailable("Tree database unavailable"); }
    const identity = await checked(query, IDENTITY);
    if (identity.status === "error") return json(503, { ok: false, connection, error: "Tree database unavailable" });
    const relation = await checked(query, RELATIONS);
    const [treesCount, treesGrouped, treesAny, claimsGrouped, claimsAny] = await Promise.all([
      checked(query, TREES_COUNT, [ORDER_ID]), checked(query, TREES_GROUPED, [ORDER_ID]), checked(query, TREES_ANY, [[ORDER_ID]]), checked(query, CLAIMS_GROUPED, [ORDER_ID]), checked(query, CLAIMS_ANY, [[ORDER_ID]])
    ]);
    const row = identity.rows[0] || {}, relationRow = relation.rows?.[0] || {};
    return json(200, { ok: true, connection: { ...connection, database: row.database, current_user: row.current_user }, relations: relation.status === "ok" ? { status: "ok", trees1: relationRow.trees1_relation || null, gift_claims: relationRow.gift_claims_relation || null } : relation, queries: { trees1_count: treesCount, trees1_grouped: treesGrouped, trees1_any: treesAny, gift_claims_grouped: claimsGrouped, gift_claims_any: claimsAny } });
  };
}
export const handler = createHandler();
