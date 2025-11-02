// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import treesHandler from "./api/trees.js";
import treesByCodesHandler from "./api/treesByCodes.js";
import treeByAdHandler from "./api/treeByAd.js";
import forestHeroes from "./api/forestHeroes.js";
import { pool } from "./api/db.js"; // <-- bovenaan importeren

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// cors
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "https://eamonnhanson.github.io",
  "https://courageous-centaur-f7d1ea.netlify.app",
  "https://map.planteenboom.nu"
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || /\.netlify\.app$/.test(origin)) {
        return cb(null, true);
      }
      console.log("❌ Blocked by CORS:", origin);
      return cb(new Error("Not allowed by CORS"));
    },
  })
);

// health
app.get("/", (_req, res) => res.json({ ok: true, msg: "Server running" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

// ===== API routes (altijd vóór static) =====
app.get("/api/trees", treesHandler);
app.get("/api/trees/by-codes", treesByCodesHandler); // ?codes=A,B
app.get("/api/trees/:id", treeByAdHandler);
app.use("/api/forest-heroes", forestHeroes); // levert boomrecords met lat/long terug

// diag endpoint vóór de /api 404-guard zetten
app.get("/api/diag/db", async (_req, res) => {
  try {
    const ping = await pool.query("SELECT 1 as ok");
    const cols = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('users1','trees1')
      ORDER BY table_name, ordinal_position
    `);
    res.json({ ping: ping.rows[0], columns: cols.rows });
  } catch (e) {
    console.error("diag error:", e.code, e.message);
    res.status(500).json({ error: "db diag failed" });
  }
});

// 404 guard voor overige /api paths (voorkomt SPA-fallback)
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" });
});

// ===== Static frontend daarna pas =====
const feDir = path.join(__dirname, "frontend", "en");
app.use(express.static(feDir));
app.get("/map", (_req, res) => res.sendFile(path.join(feDir, "index.html")));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
