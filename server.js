import express from "express";
import treesHandler from "./api/trees.js"; // adjust path if needed

const app = express();
const PORT = process.env.PORT || 10000;

// Root route (optional)
app.get("/", (req, res) => {
  res.send("Service is live 🚀");
});

// Trees API
app.get("/trees", async (req, res) => {
  try {
    const response = await treesHandler(req, {}); // call your trees.js handler
    const text = await response.text();
    res
      .status(response.status)
      .set("content-type", "application/json")
      .send(text);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
