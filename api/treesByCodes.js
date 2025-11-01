// GET /api/trees/by-codes?codes=ABC123,DEF456
export default async function treesByCodesHandler(req, res) {
  try {
    const q = req.query.codes || "";
    const codes = q.split(",").map(s => s.trim()).filter(Boolean);
    if (codes.length === 0) {
      return res.status(400).json({ ok: false, error: "parameter 'codes' is verplicht" });
    }

    // TODO: vervang door echte database query
    const items = codes.map(code => ({
      id: null,
      tree_code: code,
      tree_name: null,
      tree_type: null,
      lat: null,
      long: null
    }));

    res.json({ ok: true, count: items.length, items });
  } catch (err) {
    console.error("treesByCodes error:", err);
    res.status(500).json({ ok: false, error: "internal error" });
  }
}
