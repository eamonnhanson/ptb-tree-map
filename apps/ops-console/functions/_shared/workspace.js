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
