import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const rootUrl = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, rootUrl), "utf8");
}

function ids(html) {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
}

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    return entry.isDirectory() ? filesBelow(url) : [url];
  }));
  return nested.flat();
}

test("Dutch and English shells expose the same public-map feature contract", async () => {
  const [nl, en] = await Promise.all([
    source("frontend/index.html"),
    source("frontend/en/index.html")
  ]);

  const requiredIds = ["brand-logo", "finder", "email", "show-heroes", "msg", "map"];
  for (const id of requiredIds) {
    assert.ok(ids(nl).has(id), `Dutch shell is missing #${id}`);
    assert.ok(ids(en).has(id), `English shell is missing #${id}`);
  }

  assert.match(nl, /<html lang="nl" data-map-locale="nl">/);
  assert.match(en, /<html lang="en" data-map-locale="en">/);
  assert.match(nl, /<title>Plant N Boom • Mijn bomen<\/title>/);
  assert.match(en, /<title>Plant N Boom • My trees<\/title>/);
  assert.match(nl, /aria-label="kaart met boomlocaties"/);
  assert.match(en, /aria-label="map showing tree locations"/);
  assert.match(nl, /<span id="msg" aria-live="polite"><\/span>/);
  assert.match(en, /<span id="msg" aria-live="polite"><\/span>/);
  assert.match(nl, /<label for="email" class="sr-only">/);
  assert.match(en, /<label for="email" class="sr-only">email or user ID<\/label>/);

  for (const html of [nl, en]) {
    assert.match(html, /href="\/styles\.css"/);
    assert.match(html, /src="\/app\.js"/);
    assert.match(html, /leaflet@1\.9\.4\/dist\/leaflet\.css/);
    assert.match(html, /leaflet@1\.9\.4\/dist\/leaflet\.js/);
    assert.match(html, /sha256-p4NxAoJBhIIN\+hmNHrzRCf9tD\/miZyoHS5obTRR9BMY=/);
    assert.match(html, /sha256-20nQCchB9co0qIjJZRGuk2\/Z9VM\+kNiyxNV1lvTlZBo=/);
  }

  assert.match(en, /property="og:url" content="https:\/\/map\.planteenboom\.nu\/en\/"/);
  assert.match(en, />show my trees<\/button>/);
  assert.match(en, />\s*show Forest Heroes\s*<\/button>/);
  assert.doesNotMatch(en, /Mijn bomen|toon mijn bomen|toon forest heroes|jouw e-mail|kaart met boomlocaties/);
});

test("locale registry is closed, complete, and produces localized count forms", async () => {
  const app = await source("frontend/app.js");
  const registryEnd = app.indexOf("const requestedLocale");
  assert.ok(registryEnd > 0, "locale registry boundary was not found");

  const registrySource = app
    .slice(0, registryEnd)
    .replace("const PUBLIC_MAP_LOCALES", "globalThis.PUBLIC_MAP_LOCALES");
  const context = {};
  vm.runInNewContext(registrySource, context);

  const registry = context.PUBLIC_MAP_LOCALES;
  assert.deepEqual(Object.keys(registry), ["nl", "en"]);
  assert.deepEqual(Object.keys(registry.nl).sort(), Object.keys(registry.en).sort());
  assert.equal(registry.nl.treeCount(1), "1 boom");
  assert.equal(registry.nl.treeCount(2), "2 bomen");
  assert.equal(registry.en.treeCount(1), "1 tree");
  assert.equal(registry.en.treeCount(2), "2 trees");
  assert.equal(registry.en.treesFound(0), "0 trees found");
  assert.equal(registry.en.treesLoaded(1), "1 tree loaded…");
  assert.equal(registry.en.treesTotal(2), "2 trees in total");

  assert.match(app, /document\.documentElement\.dataset\.mapLocale/);
  assert.match(app, /Object\.hasOwn\(PUBLIC_MAP_LOCALES, requestedLocale\) \? requestedLocale : 'nl'/);
});

test("dynamic public-map UI reads localized values instead of inline Dutch literals", async () => {
  const app = await source("frontend/app.js");
  const runtime = app.slice(app.indexOf("// 🌍 Init map"));

  const requiredLookups = [
    "text.mapLayer", "text.satelliteLayer", "text.serverError", "text.treesFound",
    "text.treeCount", "text.nameLabel", "text.treeFallback", "text.copyCode",
    "text.openMaps", "text.panelCollapse", "text.panelExpand", "text.panelHeading",
    "text.filterPlaceholder", "text.noTreeCodes", "text.enterQuery", "text.loading",
    "text.loadTreesError", "text.treesLoaded", "text.treesTotal", "text.loadHeroesError",
    "text.donate", "text.donateUrl", "text.homeUrl", "text.intlLocale"
  ];
  for (const lookup of requiredLookups) assert.ok(runtime.includes(lookup), `${lookup} is not used`);

  const forbiddenRuntimeLiterals = [
    "'Kaart (OSM)'", "'Satelliet (Esri)'", "'Naam:'", "'kopieer code'",
    "'Geen boomcodes'", "'laden…'", "'kan bomen niet laden'", "'doneren'", "'nl-NL'"
  ];
  for (const literal of forbiddenRuntimeLiterals) {
    assert.ok(!runtime.includes(literal), `runtime still hard-codes ${literal}`);
  }
});

test("public-map API and deep-link contracts remain unchanged", async () => {
  const app = await source("frontend/app.js");
  assert.match(app, /https:\/\/ptb-tree-map\.onrender\.com\/api\/trees/);
  assert.match(app, /https:\/\/ptb-tree-map\.onrender\.com\/api\/forest-heroes\?/);
  assert.match(app, /query\.includes\('@'\)/);
  assert.match(app, /url\.searchParams\.set\('email', query\.trim\(\)\)/);
  assert.match(app, /url\.searchParams\.set\('user_id', query\.trim\(\)\)/);
  assert.match(app, /params\.get\('user_id'\)[\s\S]*params\.get\('id'\)[\s\S]*params\.get\('email'\)[\s\S]*params\.get\('q'\)/);
  assert.match(app, /next_after_id/);
  assert.match(app, /after_id/);
});

test("public-map and automation-dashboard assets remain isolated", async () => {
  const [nl, en, app, redirects] = await Promise.all([
    source("frontend/index.html"),
    source("frontend/en/index.html"),
    source("frontend/app.js"),
    source("frontend/_redirects")
  ]);

  for (const publicSource of [nl, en, app]) {
    assert.doesNotMatch(publicSource, /automation-dashboard|\.netlify\/functions|workflow-maintenance|ketso-admin/);
  }

  const dashboardFiles = await filesBelow(new URL("frontend/automation-dashboard/", rootUrl));
  for (const file of dashboardFiles.filter((url) => /\.(?:html|js)$/.test(url.pathname))) {
    const dashboardSource = await readFile(file, "utf8");
    assert.doesNotMatch(dashboardSource, /(?:src|href)="\/(?:app\.js|styles\.css)"/,
      `${file.pathname} imports a public-map asset`);
  }

  assert.equal(redirects.replaceAll("\r\n", "\n"), "/forest   /index.html   200\n/*        /index.html   200\n");
});

test("public-map styles include accessible, mobile, and reduced-motion contracts", async () => {
  const [css, app] = await Promise.all([
    source("frontend/styles.css"),
    source("frontend/app.js")
  ]);
  assert.match(css, /\.sr-only\s*\{/);
  assert.match(css, /@media \(max-width: 768px\)/);
  assert.match(css, /\.heroes-btn[\s\S]*width: 100%/);
  assert.match(app, /@media \(prefers-reduced-motion: reduce\)/);
});
