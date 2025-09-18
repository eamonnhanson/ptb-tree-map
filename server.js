import express from "express";
import cors from "cors";
import treesHandler from "./api/trees.js";

const app = express();
const PORT = process.env.PORT || 10000;

// ✅ Allowed origins (declare only once)
const allowedOrigins = [
  "http://localhost:3000",           // local dev
  "http://127.0.0.1:5500",           // VSCode live server etc.
  "https://eamonnhanson.github.io",  // ✅ GitHub Pages
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
