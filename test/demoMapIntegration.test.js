import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('demo map API is additive and fail-safe', async () => {
  const api = await readFile(new URL('../api/trees.js', import.meta.url), 'utf8');

  assert.match(api, /to_regclass\('public\.demo_orders'\)/);
  assert.match(api, /to_regclass\('public\.demo_order_trees'\)/);
  assert.match(api, /ord\.reserved_until > now\(\)/);
  assert.match(api, /link\.released_at IS NULL/);

  // Stable fallback remains present when demo tables are unavailable.
  assert.match(api, /FROM public\.v_user_trees/);
});

test('demo map UI supports NL, EN and FR without changing normal markers', async () => {
  const app = await readFile(new URL('../frontend/app.js', import.meta.url), 'utf8');

  assert.match(app, /DEMO – tijdelijke koppeling/);
  assert.match(app, /DEMO – temporary allocation/);
  assert.match(app, /DÉMO – attribution temporaire/);
  assert.match(app, /demoTreeIcon/);
  assert.match(app, /selectedMarker\.options\.baseIcon \|\| treeIcon/);
});
