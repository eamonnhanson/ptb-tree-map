// server.js
import express from "express";
import treesHandler from "./api/trees.js";

const app = express();

// simple health check
app.get("/", (req, res) => {
  res.json({ ok: true, msg: "Server running" });
});

// wire trees.js
app.get("/trees", async (req, res) => {
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

const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
