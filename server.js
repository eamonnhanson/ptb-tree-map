import express from 'express';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Serve static frontend files (your index.html + leaflet map)
app.use(express.static(__dirname));

app.get('/api/trees', async (req, res) => {
  try {
    const email = req.query.email;
    const userId = req.query.user_id;

    if (!email && !userId) {
      return res.status(400).json({ error: 'missing email or user_id' });
    }

    const caPath = path.join(__dirname, 'netlify/functions/ca.pem');
    const ca = fs.readFileSync(caPath).toString();

    const client = new Client({
      connectionString: process.env.PG_URL, // put in Render dashboard
      ssl: { ca, rejectUnauthorized: true }
    });

    await client.connect();

    let sql, params;
    if (email) {
      sql = `SELECT tree_code, tree_type, lat, long, area, planted_at
             FROM public.v_user_trees
             WHERE lower(email) = lower($1)
             ORDER BY planted_at NULLS LAST, tree_code`;
      params = [email];
    } else {
      sql = `SELECT tree_code, tree_type, lat, long, area, planted_at
             FROM public.v_user_trees
             WHERE user_id = $1
             ORDER BY planted_at NULLS LAST, tree_code`;
      params = [userId];
    }

    const rs = await client.query(sql, params);
    await client.end();

    res.json({ rows: rs.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
