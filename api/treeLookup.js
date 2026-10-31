export const TEST_TREE_WARNING = 'TEST TREE – not a real planted tree';
export function labelTree(row) {
  const is_test = row.is_test === true || /^TEST-WZDB-/.test(row.tree_code || '');
  return { ...row, is_test, warning: is_test ? TEST_TREE_WARNING : null };
}
export const treeColumns = `t.id, t.tree_code, t.tree_name, t.tree_type, t.lat, t."long", t.area,
 t.planted_date, COALESCE((to_jsonb(t)->>'is_test')::boolean, false) AS is_test`;
export async function queryTrees(sql, params) {
  const { pool } = await import('./db.js');
  return pool.query(sql, params);
}
