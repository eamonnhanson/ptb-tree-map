const express = require("express");
const cors = require("cors");
const treesHandler = require("./api/trees.js"); // adjust if you export differently

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Allowed origins (add your live frontends here)
const allowedOrigins = [
  "http://localhost:3000",                        // local dev
  "http://127.0.0.1:5500",                        // VSCode live server etc.
  "https://eamonnhanson.github.io",               // GitHub Pages
  "https://courageous-centaur-f7d1ea.netlify.app" // Netlify frontend
];

// ✅ Apply CORS
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

// Trees API
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
