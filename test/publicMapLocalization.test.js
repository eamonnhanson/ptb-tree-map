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

test("Dutch, English, and French shells expose the same public-map feature contract", async () => {
  const [nl, en, fr] = await Promise.all([
    source("frontend/index.html"),
    source("frontend/en/index.html"),
    source("frontend/fr/index.html")
  ]);

  const requiredIds = ["brand-logo", "finder", "email", "show-heroes", "msg", "map"];
  for (const id of requiredIds) {
    assert.ok(ids(nl).has(id), `Dutch shell is missing #${id}`);
    assert.ok(ids(en).has(id), `English shell is missing #${id}`);
    assert.ok(ids(fr).has(id), `French shell is missing #${id}`);
  }

  assert.match(nl, /<html lang="nl" data-map-locale="nl">/);
  assert.match(en, /<html lang="en" data-map-locale="en">/);
  assert.match(fr, /<html lang="fr" data-map-locale="fr">/);
  assert.match(nl, /<title>Plant N Boom • Mijn bomen<\/title>/);
  assert.match(en, /<title>Plant N Boom • My trees<\/title>/);
  assert.match(fr, /<title>Plant N Boom • Mes arbres<\/title>/);
  assert.match(nl, /aria-label="kaart met boomlocaties"/);
  assert.match(en, /aria-label="map showing tree locations"/);
  assert.match(fr, /aria-label="carte indiquant l’emplacement des arbres"/);
  assert.match(nl, /<span id="msg" aria-live="polite"><\/span>/);
  assert.match(en, /<span id="msg" aria-live="polite"><\/span>/);
  assert.match(fr, /<span id="msg" aria-live="polite"><\/span>/);
  assert.match(nl, /<label for="email" class="sr-only">/);
  assert.match(en, /<label for="email" class="sr-only">email or user ID<\/label>/);
  assert.match(fr, /<label for="email" class="sr-only">adresse e-mail ou identifiant<\/label>/);

  for (const html of [nl, en, fr]) {
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

  assert.match(fr, /name="description" content="Retrouvez vos arbres Plant N Boom et découvrez leur emplacement sur la carte\."/);
  assert.match(fr, /property="og:title" content="Plant N Boom • Mes arbres"/);
  assert.match(fr, /property="og:description" content="Retrouvez vos arbres Plant N Boom et découvrez leur emplacement sur la carte\."/);
  assert.match(fr, /property="og:url" content="https:\/\/map\.planteenboom\.nu\/fr\/"/);
  assert.match(fr, />afficher mes arbres<\/button>/);
  assert.match(fr, />\s*afficher les Forest Heroes\s*<\/button>/);
  assert.doesNotMatch(fr, /Mijn bomen|My trees|toon mijn bomen|show my trees|jouw e-mail|your email|kaart met boomlocaties|map showing tree locations/);
});

test("each locale uses the approved header logo and shared donation URL", async () => {
  const [nl, en, fr, app, css] = await Promise.all([
    source("frontend/index.html"),
    source("frontend/en/index.html"),
    source("frontend/fr/index.html"),
    source("frontend/app.js"),
    source("frontend/styles.css")
  ]);

  const dutchLogo = "https://www.planteenboom.nu/cdn/shop/files/plant_N_boom_logo_2000_1500_rectangle.png?v=1658947368&width=160";
  const englishLogo = "https://cdn.shopify.com/s/files/1/0555/9966/1149/files/Plant_a_Tree_Now_495_x_280.png?v=1714900469";
  const frenchLogo = "https://cdn.shopify.com/s/files/1/0555/9966/1149/files/plantez_un_arbre_logo_correct_250.png?v=1781612956";
  const donationUrl = "https://www.planteenboom.nu/products/doneer";

  assert.match(nl, new RegExp(`id="brand-logo"[\\s\\S]*src="${dutchLogo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(en, new RegExp(`id="brand-logo"[\\s\\S]*src="${englishLogo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(fr, new RegExp(`id="brand-logo"[\\s\\S]*src="${frenchLogo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));

  assert.match(app, /const PUBLIC_MAP_DONATION_URL = 'https:\/\/www\.planteenboom\.nu\/products\/doneer'/);
  assert.equal((app.match(/donateUrl: PUBLIC_MAP_DONATION_URL/g) || []).length, 3);
  for (const publicSource of [nl, en, fr, app]) {
    assert.doesNotMatch(publicSource, /https:\/\/www\.planteenboom\.nu\/pages\/particulier/);
  }

  const registryEnd = app.indexOf("const requestedLocale");
  const registrySource = app
    .slice(0, registryEnd)
    .replace("const PUBLIC_MAP_LOCALES", "globalThis.PUBLIC_MAP_LOCALES");
  const context = {};
  vm.runInNewContext(registrySource, context);
  assert.equal(context.PUBLIC_MAP_LOCALES.nl.donateUrl, donationUrl);
  assert.equal(context.PUBLIC_MAP_LOCALES.en.donateUrl, donationUrl);
  assert.equal(context.PUBLIC_MAP_LOCALES.fr.donateUrl, donationUrl);

  assert.match(css, /#brand-logo \{[^}]*height:34px;[^}]*width:auto;[^}]*max-width:160px;[^}]*object-fit:contain;/);
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
  assert.deepEqual(Object.keys(registry), ["nl", "en", "fr"]);
  assert.deepEqual(Object.keys(registry.nl).sort(), Object.keys(registry.en).sort());
  assert.deepEqual(Object.keys(registry.nl).sort(), Object.keys(registry.fr).sort());
  assert.equal(registry.nl.treeCount(1), "1 boom");
  assert.equal(registry.nl.treeCount(2), "2 bomen");
  assert.equal(registry.en.treeCount(1), "1 tree");
  assert.equal(registry.en.treeCount(2), "2 trees");
  assert.equal(registry.en.treesFound(0), "0 trees found");
  assert.equal(registry.en.treesLoaded(1), "1 tree loaded…");
  assert.equal(registry.en.treesTotal(2), "2 trees in total");
  assert.equal(registry.fr.intlLocale, "fr-FR");
  assert.equal(registry.fr.treeCount(1), "1 arbre");
  assert.equal(registry.fr.treeCount(2), "2 arbres");
  assert.equal(registry.fr.treesFound(0), "0 arbres trouvés");
  assert.equal(registry.fr.treesFound(1), "1 arbre trouvé");
  assert.equal(registry.fr.treesLoaded(1), "1 arbre chargé…");
  assert.equal(registry.fr.treesTotal(2), "2 arbres au total");
  assert.equal(registry.fr.loadTreesError, "impossible de charger les arbres");
  assert.equal(registry.fr.noTreeCodes, "Aucun code d’arbre");

  assert.match(app, /document\.documentElement\.dataset\.mapLocale/);
  assert.equal(context.resolvePublicMapLocale("nl"), "nl");
  assert.equal(context.resolvePublicMapLocale("en"), "en");
  assert.equal(context.resolvePublicMapLocale("fr"), "fr");
  assert.equal(context.resolvePublicMapLocale("FR"), "fr");
  assert.equal(context.resolvePublicMapLocale("de"), "nl");
  assert.equal(context.resolvePublicMapLocale(""), "nl");
  assert.equal(context.resolvePublicMapLocale(undefined), "nl");
  assert.match(app, /const localeKey = resolvePublicMapLocale\(requestedLocale\)/);
});

test("French dynamic interface content is complete and does not fall back to Dutch", async () => {
  const app = await source("frontend/app.js");
  const registryEnd = app.indexOf("const requestedLocale");
  const registrySource = app
    .slice(0, registryEnd)
    .replace("const PUBLIC_MAP_LOCALES", "globalThis.PUBLIC_MAP_LOCALES");
  const context = {};
  vm.runInNewContext(registrySource, context);

  const fr = context.PUBLIC_MAP_LOCALES.fr;
  assert.deepEqual({
    mapLayer: fr.mapLayer,
    satelliteLayer: fr.satelliteLayer,
    nameLabel: fr.nameLabel,
    copyCode: fr.copyCode,
    openMaps: fr.openMaps,
    panelCollapse: fr.panelCollapse,
    panelExpand: fr.panelExpand,
    panelHeading: fr.panelHeading,
    filterPlaceholder: fr.filterPlaceholder,
    noTreeCodes: fr.noTreeCodes,
    enterQuery: fr.enterQuery,
    loading: fr.loading,
    loadTreesError: fr.loadTreesError,
    loadHeroesError: fr.loadHeroesError,
    donate: fr.donate
  }, {
    mapLayer: "Carte (OSM)",
    satelliteLayer: "Satellite (Esri)",
    nameLabel: "Nom :",
    copyCode: "copier le code",
    openMaps: "ouvrir dans Maps",
    panelCollapse: "réduire le panneau",
    panelExpand: "développer le panneau",
    panelHeading: "codes des arbres • noms des arbres",
    filterPlaceholder: "filtrer par code ou nom",
    noTreeCodes: "Aucun code d’arbre",
    enterQuery: "saisissez votre adresse e-mail ou votre identifiant",
    loading: "chargement…",
    loadTreesError: "impossible de charger les arbres",
    loadHeroesError: "impossible de charger les Forest Heroes",
    donate: "faire un don"
  });

  const frenchUi = Object.entries(fr)
    .filter(([key, value]) => typeof value === "string" && !key.endsWith("Url") && key !== "intlLocale")
    .map(([, value]) => value)
    .join(" ");
  assert.doesNotMatch(frenchUi, /\b(?:boom|bomen|boomcodes|boomnamen|laden|doneren|paneel|Geen|Naam)\b/i);
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
  const [nl, en, fr, app, redirects] = await Promise.all([
    source("frontend/index.html"),
    source("frontend/en/index.html"),
    source("frontend/fr/index.html"),
    source("frontend/app.js"),
    source("frontend/_redirects")
  ]);

  for (const publicSource of [nl, en, fr, app]) {
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
