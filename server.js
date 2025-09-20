import express from "express";
import cors from "cors";
import treesHandler from "./api/trees.js";

const app = express();
const PORT = process.env.PORT || 10000;

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
      if (!origin) return callback(null, true); // allow server-side / curl
      if (
        allowedOrigins.includes(origin) ||
        /\.netlify\.app$/.test(origin)     // ✅ match Netlify preview URLs
      ) {
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

// ✅ Trees API — pass req,res directly
app.get("/api/trees", treesHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
