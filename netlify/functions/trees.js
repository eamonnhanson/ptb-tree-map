// netlify/functions/trees.js
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// bepaal dirname zonder __filename te redeclareren
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get('email');
    const userId = url.searchParams.get('user_id');

    if (!email && !userId) {
      return new Response(
        JSON.stringify({ error: 'missing email or user_id' }),
        { status: 400 }
      );
    }

    // pad naar certificaat relatief aan deze file
    const caPath = path.join(__dirname, 'certs', 'ca.pem');
    const ca = fs.readFileSync(caPath).toString();

    const client = new Client({
      connectionString: process.env.PG_URL, // bv. postgres://web_ro:***@host:5432/db
      ssl: {
        ca: ca,
        rejectUnauthorized: true
      }
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

    return new Response(
      JSON.stringify({ rows: rs.rows }),
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store'
        }
      }
    );
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: 'server error', details: e.message }),
      { status: 500 }
    );
  }
};
