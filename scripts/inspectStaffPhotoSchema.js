import pg from "pg";
import { readFile } from "node:fs/promises";

const connectionString = process.env.PTB_STAFF_PHOTO_POSTGRES_INTEGRATION_URL;

if (!connectionString) {
  throw new Error("PTB_STAFF_PHOTO_POSTGRES_INTEGRATION_URL is required");
}

const connection = new URL(connectionString);
for (const key of ["sslmode", "ssl", "uselibpqcompat"]) {
  connection.searchParams.delete(key);
}

const client = new pg.Client({
  connectionString: connection.toString(),
  ssl: {
    ca: await readFile(new URL("../certs/ca.pem", import.meta.url), "utf8"),
    rejectUnauthorized: true
  }
});

const metadataQuery = `
  WITH target AS (
    SELECT 'public.photo_uploads_review'::regclass AS oid
  )
  SELECT jsonb_build_object(
    'table', (
      SELECT jsonb_build_object(
        'schema', n.nspname,
        'name', c.relname,
        'persistence', c.relpersistence,
        'reloptions', c.reloptions
      )
      FROM target t
      JOIN pg_class c ON c.oid = t.oid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    ),
    'columns', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', a.attname,
        'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
        'not_null', a.attnotnull,
        'default', pg_get_expr(d.adbin, d.adrelid),
        'identity', a.attidentity,
        'generated', a.attgenerated,
        'collation', CASE WHEN a.attcollation = 0 THEN NULL ELSE coll.collname END
      ) ORDER BY a.attnum)
      FROM target t
      JOIN pg_attribute a ON a.attrelid = t.oid
      LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      LEFT JOIN pg_collation coll ON coll.oid = a.attcollation
      WHERE a.attnum > 0 AND NOT a.attisdropped
    ),
    'constraints', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', con.conname,
        'type', con.contype,
        'definition', pg_get_constraintdef(con.oid, true)
      ) ORDER BY con.conname)
      FROM target t
      JOIN pg_constraint con ON con.conrelid = t.oid
    ),
    'indexes', (
      SELECT jsonb_agg(jsonb_build_object(
        'name', idx.relname,
        'definition', pg_get_indexdef(idx.oid)
      ) ORDER BY idx.relname)
      FROM target t
      JOIN pg_index i ON i.indrelid = t.oid
      JOIN pg_class idx ON idx.oid = i.indexrelid
    ),
    'owned_sequences', (
      SELECT jsonb_agg(jsonb_build_object(
        'schema', n.nspname,
        'name', seq.relname,
        'start_value', sequence.seqstart,
        'increment_by', sequence.seqincrement,
        'minimum_value', sequence.seqmin,
        'maximum_value', sequence.seqmax,
        'cache_size', sequence.seqcache,
        'cycle', sequence.seqcycle
      ) ORDER BY seq.relname)
      FROM target t
      JOIN pg_depend dep ON dep.refobjid = t.oid AND dep.deptype IN ('a', 'i')
      JOIN pg_class seq ON seq.oid = dep.objid AND seq.relkind = 'S'
      JOIN pg_namespace n ON n.oid = seq.relnamespace
      JOIN pg_sequence sequence ON sequence.seqrelid = seq.oid
    ),
    'referenced_relations', (
      SELECT jsonb_agg(jsonb_build_object(
        'schema', n.nspname,
        'name', c.relname,
        'constraint', con.conname,
        'definition', pg_get_constraintdef(con.oid, true)
      ) ORDER BY con.conname)
      FROM target t
      JOIN pg_constraint con ON con.conrelid = t.oid AND con.contype = 'f'
      JOIN pg_class c ON c.oid = con.confrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
    )
  ) AS metadata;
`;

try {
  await client.connect();
  const result = await client.query(metadataQuery);
  console.log(JSON.stringify(result.rows[0].metadata, null, 2));
} finally {
  await client.end();
}
