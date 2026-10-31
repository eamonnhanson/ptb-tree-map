import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const migration = await readFile(
  new URL('../docs/sql/027_november_demo_pool.sql', import.meta.url),
  'utf8'
);

test('November real-tree demo pool migration and 24-hour reservations', async t => {
  const db = new PGlite();
  const q = (sql, args = []) => db.query(sql, args);

  try {
    await db.exec(`
      CREATE TABLE public.users1 (
        id serial PRIMARY KEY,
        email text UNIQUE NOT NULL,
        created_at timestamp,
        updated_at timestamp
      );

      CREATE TABLE public.trees1 (
        id serial PRIMARY KEY,
        tree_code text UNIQUE,
        tree_type text,
        area text,
        tree_name text,
        lat numeric,
        "long" numeric,
        planted_date date,
        user_id integer REFERENCES public.users1(id),
        order_id varchar(50),
        is_claimed boolean DEFAULT false,
        purchase_date timestamp,
        reserved_token text,
        claimed_token text,
        claimed_at timestamptz,
        unclaimed_user_id integer,
        updated_at timestamp
      );
    `);

    const user = (await q(
      `INSERT INTO users1(email, created_at, updated_at)
       VALUES ('mark.kirkels@warchild.nl', now(), now())
       RETURNING id`
    )).rows[0];

    await q(`
      INSERT INTO trees1(
        tree_code, tree_type, area, tree_name, lat, "long", planted_date,
        user_id, order_id, is_claimed, purchase_date, reserved_token,
        claimed_token, claimed_at, unclaimed_user_id, updated_at
      )
      SELECT
        'WAR-' || lpad(n::text, 4, '0'),
        'Cashew',
        'Makombeh',
        'War Child tree ' || n,
        8.9 + n * 0.000001,
        -12.5 - n * 0.000001,
        DATE '2026-06-01',
        $1,
        'WC-' || n,
        true,
        TIMESTAMP '2026-06-01 10:00:00',
        'reserve-' || n,
        'claim-' || n,
        TIMESTAMPTZ '2026-06-01 10:00:00+00',
        9000 + n,
        now()
      FROM generate_series(1, 600) n
    `, [user.id]);

    await db.exec(migration);

    await t.test('migration alone does not alter existing allocations', async () => {
      const row = (await q(`
        SELECT count(*)::int AS n,
               count(*) FILTER (WHERE demo_pool)::int AS demo
        FROM trees1
        WHERE user_id = $1
      `, [user.id])).rows[0];

      assert.equal(row.n, 600);
      assert.equal(row.demo, 0);
    });

    await t.test('wrong confirmation fails closed with no release', async () => {
      await assert.rejects(
        q(`SELECT prepare_november_2026_demo_pool(
          'mark.kirkels@warchild.nl', 'NO'
        )`),
        /confirmation/
      );

      assert.equal(
        (await q('SELECT count(*)::int AS n FROM trees1 WHERE user_id=$1', [user.id])).rows[0].n,
        600
      );
    });

    await t.test('releases exactly 600, with 100 demo and 500 sale trees', async () => {
      const result = (await q(`
        SELECT prepare_november_2026_demo_pool(
          'mark.kirkels@warchild.nl',
          'RELEASE 600 WAR CHILD TREES FOR NOVEMBER DEMO'
        ) AS result
      `)).rows[0].result;

      assert.equal(result.status, 'prepared');
      assert.equal(result.released_count, 600);
      assert.equal(result.demo_count, 100);
      assert.equal(result.sale_count, 500);

      const counts = (await q(`
        SELECT
          count(*)::int AS total,
          count(*) FILTER (WHERE demo_pool)::int AS demo,
          count(*) FILTER (WHERE NOT demo_pool)::int AS sale,
          count(*) FILTER (WHERE user_id IS NOT NULL)::int AS still_owned,
          count(*) FILTER (WHERE is_claimed)::int AS still_claimed
        FROM trees1
      `)).rows[0];

      assert.deepEqual(counts, {
        total: 600,
        demo: 100,
        sale: 500,
        still_owned: 0,
        still_claimed: 0
      });

      assert.equal(
        (await q('SELECT count(*)::int AS n FROM tree_allocation_release_audit')).rows[0].n,
        600
      );

      const audit = (await q(`
        SELECT original_tree->>'user_id' AS user_id,
               original_tree->>'tree_name' AS tree_name,
               destination
        FROM tree_allocation_release_audit
        ORDER BY tree_id
        LIMIT 1
      `)).rows[0];

      assert.equal(Number(audit.user_id), user.id);
      assert.match(audit.tree_name, /War Child tree/);
      assert.equal(audit.destination, 'demo_pool');

      const cleared = (await q(`
        SELECT count(*)::int AS n
        FROM trees1
        WHERE purchase_date IS NOT NULL
           OR reserved_token IS NOT NULL
           OR claimed_token IS NOT NULL
           OR claimed_at IS NOT NULL
           OR unclaimed_user_id IS NOT NULL
           OR order_id IS NOT NULL
           OR tree_name IS NOT NULL
      `)).rows[0].n;

      assert.equal(cleared, 0);
    });

    await t.test('pool preparation is idempotent and cannot release another 600', async () => {
      const result = (await q(`
        SELECT prepare_november_2026_demo_pool(
          'mark.kirkels@warchild.nl',
          'RELEASE 600 WAR CHILD TREES FOR NOVEMBER DEMO'
        ) AS result
      `)).rows[0].result;

      assert.equal(result.status, 'already_prepared');
      assert.equal(
        (await q('SELECT count(*)::int AS n FROM tree_allocation_release_audit')).rows[0].n,
        600
      );
    });

    let firstAllocation;

    await t.test('SKU test reserves real demo trees without changing ownership fields', async () => {
      firstAllocation = (await q(`
        SELECT allocate_demo_order(
          '70000000001',
          'test',
          '64172819480906',
          'trainer@example.test',
          5
        ) AS result
      `)).rows[0].result;

      assert.equal(firstAllocation.duplicate, false);
      assert.equal(firstAllocation.assigned_trees.length, 5);
      assert.ok(firstAllocation.assigned_trees.every(tree => tree.is_demo === true));

      const ids = firstAllocation.assigned_trees.map(tree => tree.tree_id);
      const rows = (await q(`
        SELECT id, demo_pool, user_id, is_claimed, order_id
        FROM trees1
        WHERE id = ANY($1)
        ORDER BY id
      `, [ids])).rows;

      assert.equal(rows.length, 5);
      assert.ok(rows.every(row => row.demo_pool === true));
      assert.ok(rows.every(row => row.user_id === null));
      assert.ok(rows.every(row => row.is_claimed === false));
      assert.ok(rows.every(row => row.order_id === null));

      const expires = new Date(firstAllocation.reserved_until).getTime();
      const hours = (expires - Date.now()) / 3600000;
      assert.ok(hours > 23.5 && hours < 24.5);
    });

    await t.test('duplicate Shopify delivery returns the same demo trees', async () => {
      const replay = (await q(`
        SELECT allocate_demo_order(
          '70000000001',
          'test',
          '64172819480906',
          'trainer@example.test',
          5
        ) AS result
      `)).rows[0].result;

      assert.equal(replay.duplicate, true);
      assert.deepEqual(
        replay.assigned_trees.map(tree => tree.tree_id),
        firstAllocation.assigned_trees.map(tree => tree.tree_id)
      );
      assert.equal(
        (await q(`SELECT count(*)::int AS n
                  FROM demo_order_trees
                  WHERE shopify_order_id='70000000001'`)).rows[0].n,
        5
      );
    });

    await t.test('wrong SKU and variant are rejected', async () => {
      await assert.rejects(
        q(`SELECT allocate_demo_order(
          '70000000002','02','64172819480906','trainer@example.test',1
        )`),
        /SKU/
      );
      await assert.rejects(
        q(`SELECT allocate_demo_order(
          '70000000002','test','999','trainer@example.test',1
        )`),
        /variant/
      );
    });

    await t.test('500 released non-demo trees remain eligible for normal sale inventory', async () => {
      const n = (await q(`
        SELECT count(*)::int AS n
        FROM trees1
        WHERE user_id IS NULL
          AND is_claimed IS NOT TRUE
          AND order_id IS NULL
          AND demo_pool = false
      `)).rows[0].n;
      assert.equal(n, 500);
    });

    await t.test('expired reservations are released and reusable', async () => {
      const firstIds = firstAllocation.assigned_trees.map(tree => tree.tree_id);

      await q(`
        UPDATE demo_orders
        SET reserved_until = now() - interval '1 minute'
        WHERE shopify_order_id='70000000001'
      `);

      const released = (await q(
        'SELECT release_expired_demo_reservations() AS n'
      )).rows[0].n;
      assert.equal(released, 5);

      const next = (await q(`
        SELECT allocate_demo_order(
          '70000000003',
          'test',
          '64172819480906',
          'next@example.test',
          5
        ) AS result
      `)).rows[0].result;

      const nextIds = next.assigned_trees.map(tree => tree.tree_id);
      assert.deepEqual(nextIds, firstIds);
    });

    await t.test('demo quantity is bounded to protect the 100-tree pool', async () => {
      await assert.rejects(
        q(`SELECT allocate_demo_order(
          '70000000004',
          'test',
          '64172819480906',
          'trainer@example.test',
          11
        )`),
        /between 1 and 10/
      );
    });
  } finally {
    await db.close();
  }
});

test('public map code contains active demo-expiry support', async () => {
  const api = await readFile(new URL('../api/trees.js', import.meta.url), 'utf8');
  const frontend = await readFile(new URL('../frontend/app.js', import.meta.url), 'utf8');

  assert.match(api, /demo_orders/);
  assert.match(api, /reserved_until > now\(\)/);
  assert.match(api, /released_at IS NULL/);
  assert.match(frontend, /DEMO – tijdelijke koppeling/);
  assert.match(frontend, /demo_expires_at/);
});

test('production subscription allocators exclude demo_pool trees', async () => {
  const shopify = await readFile(
    new URL('../docs/sql/011_shopify_subscription_tree_allocation.sql', import.meta.url),
    'utf8'
  );
  const chargebee = await readFile(
    new URL('../docs/sql/014_chargebee_subscription_payment_allocation.sql', import.meta.url),
    'utf8'
  );

  assert.match(shopify, /demo_pool/);
  assert.match(chargebee, /demo_pool/);
});
