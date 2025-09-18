import express from "express";
import cors from "cors";
import treesHandler from "./api/trees.js";

const app = express();
const PORT = process.env.PORT || 10000;

// Allowed origins
const allowedOrigins = [
  "http://localhost:3000",               // local dev
  "http://127.0.0.1:5500",              // local dev (e.g. VSCode Live Server)
  "https://eamonnhanson.github.io",     // ✅ your GitHub Pages frontend
];

// Allowed origins (extend later, e.g. add your Shopify domain)
const allowedOrigins = [
  "https://ptb-tree-map.onrender.com", // Render app
  // "https://yourshop.myshopify.com"   // add later when embedding in Shopify
];

// Dynamic CORS options
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
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

// Wire trees.js
app.get("/api/trees", async (req, res) => {
  try {
    const response = await treesHandler(req, {});
    const text = await response.text();
    res
      .status(response.status)
      .set(Object.fromEntries(response.headers))
      .send(text);
  } catch (err) {
    console.error("Handler failed:", err);
    res.status(500).json({ error: "server crash", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
