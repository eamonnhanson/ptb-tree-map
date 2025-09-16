import express from "express";
import treesHandler from "./api/trees.js"; // adjust if path is different

const app = express();
const PORT = process.env.PORT || 10000;

// Root check
app.get("/", (req, res) => {
  res.send("🌳 Tree API is live on Render");
});

// Trees API
app.get("/trees", async (req, res) => {
  try {
    // Call the handler from trees.js
    const response = await treesHandler(req, {});

    // If trees.js returns a Response object (like in Netlify style)
    const text = await response.text();
    res
      .status(response.status)
      .set("content-type", response.headers.get("content-type") || "application/json")
      .send(text);
  } catch (err) {
    console.error("Error in /trees:", err);
    res.status(500).json({ error: "server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
