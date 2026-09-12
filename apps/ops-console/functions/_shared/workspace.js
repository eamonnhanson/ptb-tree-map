import { read, readTrees } from './db.js';
import { listActions, listWorkflows } from './repository.js';
import { reportFailure } from './diagnostics.js';
import { partners } from './partners.js';

export const COUNT_QUERIES = Object.freeze({
  trees: `select count(*)::text as count from public.trees1
    where user_id is null
    and nullif(trim(tree_name), '') is null
    and lat is not null and "long" is not null`,
  uploads: `select count(*)::text as count from public.photo_uploads_review
    where review_status = 'pending'`,
  questions: `select count(*)::text as count from public.academy_tutor_questions
    where status = 'new'`
});

// This query intentionally counts current tree rows only.  The credit-account
// table is one row per user and the grouped allocation CTE prevents a join
// from multiplying trees when the setup data is reviewed or extended.
export const IMCD_CREDIT_QUERY = `with credit as (
  select customer_code, starts_at, opening_trees, alert_threshold, account_manager
  from public.ops_console_tree_credits where customer_code = 'imcd_benelux'
), topups as (
  select credit_code, coalesce(sum(trees), 0)::bigint as trees
  from public.ops_console_tree_credit_topups
  where credit_code = 'imcd_benelux' group by credit_code
), usage_by_account as (
  select a.region, a.user_id, count(t.id)::bigint as trees
  from public.ops_console_tree_credit_accounts a
  join credit c on c.customer_code = a.credit_code
  left join public.trees1 t on t.user_id = a.user_id and t.claimed_at >= c.starts_at
  where a.credit_code = 'imcd_benelux'
  group by a.region, a.user_id
), usage_by_region as (
  select region, sum(trees)::bigint as trees from usage_by_account group by region
)
select c.starts_at, c.opening_trees::bigint, c.alert_threshold::bigint, c.account_manager,
  coalesce(t.trees, 0)::bigint as topup_trees,
  coalesce((select trees from usage_by_region where region = 'NL'), 0)::bigint as nl_trees,
  coalesce((select trees from usage_by_region where region = 'BE'), 0)::bigint as be_trees,
  (c.opening_trees + coalesce(t.trees, 0) - coalesce((select sum(trees) from usage_by_account), 0))::bigint as balance
from credit c left join topups t on t.credit_code = c.customer_code`;

function checkedCount(result) {
  const raw = result?.rows?.[0]?.count;
  if (raw === null || raw === undefined || !/^\d+$/.test(String(raw))) throw new Error('INVALID_COUNT');
  const count = Number(raw);
  if (!Number.isSafeInteger(count)) throw new Error('INVALID_COUNT');
  return { count };
}

// Sources fail independently; missing access never becomes a zero count.
export async function loadWorkspace(deps = {}) {
  const query = deps.read || read;
  const treeQuery = deps.readTrees || (deps.read ? deps.read : readTrees);
  const loaders = {
    workflows: deps.listWorkflows || listWorkflows,
    actions: deps.listActions || listActions,
    trees: async () => checkedCount(await treeQuery(COUNT_QUERIES.trees)),
    imcd_credit: async () => checkedImcdCredit(await treeQuery(IMCD_CREDIT_QUERY)),
    uploads: async () => checkedCount(await query(COUNT_QUERIES.uploads)),
    questions: async () => checkedCount(await query(COUNT_QUERIES.questions))
  };
  const entries = await Promise.all(Object.entries(loaders).map(async ([key, loader]) => {
    try { return [key, { available: true, data: await loader() }]; }
    catch (error) {
      reportFailure(error, key);
      return [key, { available: false, data: null }];
    }
  }));
  const minimum = Number(process.env.OPS_CONSOLE_MIN_FREE_TREES || 0);
  return { sources: Object.fromEntries(entries), partners,
    minimum_free_trees: Number.isSafeInteger(minimum) && minimum >= 0 ? minimum : 0 };
}

function checkedImcdCredit(result) {
  const row = result?.rows?.[0];
  if (!row || !['opening_trees', 'alert_threshold', 'topup_trees', 'nl_trees', 'be_trees', 'balance'].every(key => Number.isSafeInteger(Number(row[key]))) || !row.starts_at || !row.account_manager) throw new Error('INVALID_IMCD_CREDIT');
  return { starts_at: row.starts_at, opening_trees: Number(row.opening_trees), alert_threshold: Number(row.alert_threshold), topup_trees: Number(row.topup_trees), nl_trees: Number(row.nl_trees), be_trees: Number(row.be_trees), balance: Number(row.balance), account_manager: String(row.account_manager) };
}
