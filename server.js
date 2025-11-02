// server.js
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import treesHandler from "./api/trees.js";
import treesByCodesHandler from "./api/treesByCodes.js";
import treeByAdHandler from "./api/treeByAd.js";
import forestHeroes from "./api/forestHeroes.js";
import { pool } from "./api/db.js";

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
app.get("/api/trees/by-codes", treesByCodesHandler);
app.get("/api/trees/:id", treeByAdHandler);
app.use("/api/forest-heroes", forestHeroes);

// ===== diagnose endpoints =====

// 1) basis DB-info
app.get("/api/diag/info", (_req, res) => {
  try {
    const u = new URL(process.env.DATABASE_URL);
    res.json({
      ok: true,
      host: u.hostname,
      db: u.pathname.slice(1),
      ssl: process.env.NODE_ENV === "production"
    });
  } catch {
    res.status(500).json({ ok: false, error: "DATABASE_URL ongeldig of ontbreekt" });
  }
});

// 2) ping en kolommen users1/trees1
app.get("/api/diag/db", async (_req, res) => {
  try {
    const ping = await pool.query("select now() as now");
    const cols = await pool.query(`
      select table_schema, table_name, column_name
      from information_schema.columns
      where table_name in ('users1','trees1')
      order by table_schema, table_name, ordinal_position
    `);
    res.json({ ok: true, now: ping.rows[0].now, columns: cols.rows });
  } catch (e) {
    console.error("diag db error:", {
      code: e.code, message: e.message, detail: e.detail, errno: e.errno, address: e.address, port: e.port
    });
    res.status(500).json({
      ok: false,
      code: e.code || null,
      message: e.message || null,
      detail: e.detail || null,
      errno: e.errno || null,
      address: e.address || null,
      port: e.port || null
    });
  }
});

// 3) minimale heroes-check op 1 gebruiker of mail, met preview
app.get("/api/diag/heroes", async (req, res) => {
  const params = [];
  const where = [
    "u.subscription_type IS NOT NULL",
    "t.lat IS NOT NULL",
    "t.long IS NOT NULL"
  ];

  if (req.query.user_id && /^\d+$/.test(req.query.user_id)) {
    params.push(parseInt(req.query.user_id, 10));
    where.push(`u.id = $${params.length}`);
  }
  if (req.query.email) {
    params.push(req.query.email.trim());
    where.push(`LOWER(u.email) = LOWER($${params.length})`);
  }

  const sqlCount = `
    select count(*)::int as n
    from public.trees1 t
    join public.users1 u on u.id = t.user_id
    where ${where.join(" and ")}
  `;
  const sqlPreview = `
    select t.id, t.lat, t.long, t.tree_code, t.tree_type, t.tree_name, u.id as user_id, u.email
    from public.trees1 t
    join public.users1 u on u.id = t.user_id
    where ${where.join(" and ")}
    order by t.id asc
    limit 1
  `;

  try {
    const [{ rows: [cnt] }, { rows: prev }] = await Promise.all([
      pool.query(sqlCount, params),
      pool.query(sqlPreview, params)
    ]);
    res.json({ ok: true, count: cnt?.n ?? 0, preview: prev?.[0] ?? null });
  } catch (e) {
    console.error("diag heroes error:", { code: e.code, message: e.message, detail: e.detail });
    res.status(500).json({ ok: false, code: e.code || null, message: e.message || null, detail: e.detail || null });
  }
});

// 404 guard voor overige /api paths
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" });
});

// ===== static frontend daarna pas =====
const feDir = path.join(__dirname, "frontend", "en");
app.use(express.static(feDir));
app.get("/map", (_req, res) => res.sendFile(path.join(feDir, "index.html")));

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
