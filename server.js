// server.js
import express from "express";
import cors from "cors";
import treesHandler from "./api/trees.js";

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS for all routes
app.use(cors());

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
