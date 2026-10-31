import { labelTree, treeColumns, queryTrees } from './treeLookup.js';
export function createTreesByCodesHandler(query = queryTrees) {
  return async (req, res) => {
    const codes = [...new Set(String(req.query.codes || '').split(',').map(s => s.trim()).filter(Boolean))];
    if (!codes.length || codes.length > 100 || codes.some(code => code.length > 100)) {
      return res.status(400).json({ ok: false, error: 'Provide 1–100 tree codes' });
    }
    try {
      const { rows } = await query(`SELECT ${treeColumns} FROM public.trees1 t
        WHERE t.tree_code = ANY($1::text[]) AND t.user_id IS NOT NULL ORDER BY t.id`, [codes]);
      const items = rows.map(labelTree);
      return res.json({ ok: true, count: items.length, items });
    } catch {
      return res.status(500).json({ ok: false, error: 'Tree lookup failed' });
    }
  };
}
export default createTreesByCodesHandler();
