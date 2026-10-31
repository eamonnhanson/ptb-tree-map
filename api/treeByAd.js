import { labelTree, treeColumns, queryTrees } from './treeLookup.js';
export default async function treeByAdHandler(req, res) {
  if (!/^[0-9]{1,10}$/.test(String(req.params.id || ''))) return res.status(400).json({ ok: false, error: 'Invalid tree ID' });
  try {
    const { rows } = await queryTrees(`SELECT ${treeColumns} FROM public.trees1 t
      WHERE t.id = $1::bigint AND t.user_id IS NOT NULL`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ ok: false, error: 'Tree not found' });
    return res.json({ ok: true, item: labelTree(rows[0]) });
  } catch {
    return res.status(500).json({ ok: false, error: 'Tree lookup failed' });
  }
}
