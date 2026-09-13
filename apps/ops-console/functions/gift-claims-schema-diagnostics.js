import { readTrees } from "./_shared/db.js";
import { guardGet, json, unavailable } from "./_shared/http.js";

const IDENTITY = "select current_database() as database, current_user as current_user";
const RELATION = "select to_regclass('public.gift_claims') as relation";
const COLUMNS = "select column_name,data_type,is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'gift_claims' order by ordinal_position";

export function createHandler({ query = readTrees } = {}) {
  return async event => {
    const guard = guardGet(event); if (guard) return guard;
    try {
      const [identity, relation, columns] = await Promise.all([query(IDENTITY), query(RELATION), query(COLUMNS)]);
      return json(200, { ok: true, database: identity.rows[0]?.database, current_user: identity.rows[0]?.current_user, relation: relation.rows[0]?.relation || null, columns: columns.rows || [] });
    } catch { return unavailable("Gift claims schema diagnostics are unavailable"); }
  };
}
export const handler = createHandler();
