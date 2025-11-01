// api/forestHeroes.js
import express from "express";
const router = express.Router();

// voorbeeld: laadt heroes uit je database of statisch JSON-bestand
router.get("/", async (req, res) => {
  try {
    const heroes = [
      { id: 1, name: "Eamonn", trees: 12 },
      { id: 2, name: "Harm", trees: 8 }
    ];
    res.json(heroes);
  } catch (err) {
    console.error("ForestHeroes fout:", err);
    res.status(500).json({ error: "Serverfout" });
  }
});

export default router;
