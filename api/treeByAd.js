// GET /api/trees/:id
export default async function treeByIdHandler(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, error: "id ontbreekt" });

    // TODO: vervang door echte database query
    const item = {
      id,
      tree_code: null,
      tree_name: null,
      tree_type: null,
      lat: null,
      long: null
    };

    res.json({ ok: true, item });
  } catch (err) {
    console.error("treeByAd error:", err);
    res.status(500).json({ ok: false, error: "internal error" });
  }
}
