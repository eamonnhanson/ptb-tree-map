// server.js
import express from "express";
import cors from "cors";
import treesHandler from "./api/trees.js";

const app = express();
const PORT = process.env.PORT || 10000;

// CORS fix: allow GitHub Pages + localhost
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "https://eamonnhanson.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Allowed origins (extend later, e.g. add your Shopify domain)
const allowedOrigins = [
  "https://ptb-tree-map.onrender.com", // Render app
  // "https://yourshop.myshopify.com"   // add later when embedding in Shopify
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like same-origin or curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

// Enable CORS
app.use(cors(corsOptions));

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
