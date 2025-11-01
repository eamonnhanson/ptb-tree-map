import express from "express";
import cors from "cors";

import treesHandler from "./api/trees.js";
// nieuwe handlers
import treesByCodesHandler from "./api/treesByCodes.js"; // GET /api/trees/by-codes?codes=ABC123,DEF456
import treeByAdHandler from "./api/treeByAd.js";         // GET /api/trees/:id
import forestHeroes from "./api/forestHeroes.js";        // GET /api/forest-heroes

const app = express();
const PORT = process.env.PORT || 10000;

// body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "https://eamonnhanson.github.io",
  "https://courageous-centaur-f7d1ea.netlify.app",
  "https://map.planteenboom.nu"
];

// Apply CORS
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // server-side of curl
      if (allowedOrigins.includes(origin) || /\.netlify\.app$/.test(origin)) {
        callback(null, true);
      } else {
        console.log("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);

// Root health check
app.get("/", (req, res) => {
  res.json({ ok: true, msg: "Server running" });
});

// Trees API — bestaande endpoint
app.get("/api/trees", treesHandler);

// nieuw: compacte info op basis van meerdere codes
// voorbeeld: GET /api/trees/by-codes?codes=SL1234,SL5678
app.get("/api/trees/by-codes", treesByCodesHandler);

// nieuw: 1 tree ophalen op id
// voorbeeld: GET /api/trees/42
app.get("/api/trees/:id", treeByAdHandler);

// nieuw: forest heroes endpoint
app.use("/api/forest-heroes", forestHeroes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
