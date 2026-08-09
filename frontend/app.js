const PUBLIC_MAP_LOCALES = Object.freeze({
  nl: Object.freeze({
    intlLocale: 'nl-NL',
    mapLayer: 'Kaart (OSM)',
    satelliteLayer: 'Satelliet (Esri)',
    serverError: status => `serverfout ${status}`,
    treeCount: count => `${count} ${count === 1 ? 'boom' : 'bomen'}`,
    treesFound: count => `${count} ${count === 1 ? 'boom gevonden' : 'bomen gevonden'}`,
    treesLoaded: count => `${count} ${count === 1 ? 'boom geladen…' : 'bomen geladen…'}`,
    treesTotal: count => `${count} ${count === 1 ? 'boom totaal' : 'bomen totaal'}`,
    treeFallback: 'boom',
    nameLabel: 'Naam:',
    copyCode: 'kopieer code',
    openMaps: 'open in maps',
    panelCollapse: 'paneel inklappen',
    panelExpand: 'paneel uitklappen',
    panelHeading: 'boomcodes • boomnamen',
    filterPlaceholder: 'filter op code of naam',
    noTreeCodes: 'Geen boomcodes',
    enterQuery: 'voer e-mail of user_id in',
    loading: 'laden…',
    loadTreesError: 'kan bomen niet laden',
    loadHeroesError: 'kan Forest Heroes niet laden',
    donate: 'doneren',
    donateUrl: 'https://www.planteenboom.nu/pages/particulier',
    homeUrl: 'https://www.planteenboom.nu/'
  }),
  en: Object.freeze({
    intlLocale: 'en-GB',
    mapLayer: 'Map (OSM)',
    satelliteLayer: 'Satellite (Esri)',
    serverError: status => `server error ${status}`,
    treeCount: count => `${count} ${count === 1 ? 'tree' : 'trees'}`,
    treesFound: count => `${count} ${count === 1 ? 'tree found' : 'trees found'}`,
    treesLoaded: count => `${count} ${count === 1 ? 'tree loaded…' : 'trees loaded…'}`,
    treesTotal: count => `${count} ${count === 1 ? 'tree in total' : 'trees in total'}`,
    treeFallback: 'tree',
    nameLabel: 'Name:',
    copyCode: 'copy code',
    openMaps: 'open in maps',
    panelCollapse: 'collapse panel',
    panelExpand: 'expand panel',
    panelHeading: 'tree codes • tree names',
    filterPlaceholder: 'filter by code or name',
    noTreeCodes: 'No tree codes',
    enterQuery: 'enter your email or user ID',
    loading: 'loading…',
    loadTreesError: 'unable to load trees',
    loadHeroesError: 'unable to load Forest Heroes',
    donate: 'donate',
    donateUrl: 'https://www.planteenboom.nu/pages/particulier',
    homeUrl: 'https://www.planteenboom.nu/'
  })
});

const requestedLocale = (document.documentElement.dataset.mapLocale || '').toLowerCase();
const localeKey = Object.hasOwn(PUBLIC_MAP_LOCALES, requestedLocale) ? requestedLocale : 'nl';
const text = PUBLIC_MAP_LOCALES[localeKey];

// 🌍 Init map
const map = L.map('map').setView([8.5, -13.2], 7);

// 🧱 basemaps
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const esriSat = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
);

// 🧭 layers control (rechtsboven)
L.control.layers(
  { [text.mapLayer]: osm, [text.satelliteLayer]: esriSat },
  {},
  { position: 'topright', collapsed: true }
).addTo(map);

// 📏 schaalbalk (linksonder)
L.control.scale({ imperial: false, maxWidth: 120 }).addTo(map);

// 📍 Marker layer
const markers = L.layerGroup().addTo(map);
const msg = document.getElementById('msg');

// 📦 state
const markersByCode = new Map();
let selectedMarker = null;
let selectedItemEl = null;

// 🎨 iconen
const treeIcon = L.icon({
  iconUrl: 'https://cdn.shopify.com/s/files/1/0555/9966/1149/files/logoboom_32.png?v=1762456736',
  iconSize: [32, 32],
  iconAnchor: [16, 28],
  popupAnchor: [0, -24],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

const treeIconDark = L.icon({
  iconUrl: 'https://cdn.shopify.com/s/files/1/0555/9966/1149/files/pnb_boomicoon_dark_32.png?v=1762457017',
  iconSize: [32, 32],
  iconAnchor: [16, 28],
  popupAnchor: [0, -24],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// geselecteerde variant
const treeIconSelected = L.icon({
  iconUrl: 'https://cdn.shopify.com/s/files/1/0555/9966/1149/files/pnb_boomicoon_red_32.png?v=1762457875',
  iconSize: [32, 32],
  iconAnchor: [16, 28],
  popupAnchor: [0, -24],
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// 🔎 Fetch trees by email or user_id
async function fetchTrees(query) {
  const baseUrl = "https://ptb-tree-map.onrender.com/api/trees";
  const url = new URL(baseUrl);

  if (query.includes('@')) {
    url.searchParams.set('email', query.trim());
  } else {
    url.searchParams.set('user_id', query.trim());
  }

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(text.serverError(res.status));
  return res.json();
}

// 🖼️ Render markers on map
function renderTrees(rows) {
  markers.clearLayers();
  markersByCode.clear();
  clearSelection();
  ensureCodePanel();

  if (!rows.length) {
    msg.textContent = text.treesFound(0);
    renderCodeList([]);
    return;
  }

  const bounds = [];
  rows.forEach(r => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.long);
    if (isNaN(lat) || isNaN(lng)) {
      console.warn("Skipping invalid coords:", r);
      return;
    }

    const code = (r.tree_code || '').trim();
    const name = (r.tree_name || '').trim();
    const type = r.tree_type || '';
    const area = r.area || '';
    const planted = r.planted_date ? new Date(r.planted_date).toLocaleDateString(text.intlLocale) : '';
    const gmaps = `https://maps.google.com/?q=${lat},${lng}`;

    const nameRow = name ? `<div class="popup-line"><strong>${text.nameLabel}</strong> ${name}</div>` : '';

    const popup =
      `<div class="popup">
         <div class="popup-title">${code || text.treeFallback}</div>
         ${nameRow}
         <div class="popup-sub">${type} ${area ? '• ' + area : ''}</div>
         <div class="popup-meta">${planted}</div>
         <div class="popup-actions">
           <button class="btn-link" onclick="navigator.clipboard.writeText('${code || ''}')">${text.copyCode}</button>
           <a class="btn-link" href="${gmaps}" target="_blank" rel="noopener">${text.openMaps}</a>
         </div>
       </div>`;

    const m = L.marker([lat, lng], { icon: treeIcon }).bindPopup(popup);
    m.on('click', () => selectByMarker(m, code));
    markers.addLayer(m);
    bounds.push([lat, lng]);

    if (code) markersByCode.set(code.toLowerCase(), m);
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });

  msg.textContent = text.treeCount(rows.length);
  renderTrees.rows = rows;
  renderCodeList(rows);
}

// 🧼 selectie wissen
function clearSelection() {
  if (selectedMarker) {
    selectedMarker.setIcon(treeIcon);
    selectedMarker = null;
  }
  if (selectedItemEl) {
    selectedItemEl.classList.remove('active');
    selectedItemEl = null;
  }
}

// ✅ selecteer via marker
function selectByMarker(marker, codeText) {
  clearSelection();
  selectedMarker = marker;
  marker.setIcon(treeIconSelected).openPopup();
  if (codeText) {
    const item = document.querySelector(
      `[data-tree-code="${cssEscape(codeText.toLowerCase())}"]`
    );
    if (item) {
      item.classList.add('active');
      selectedItemEl = item;
      item.scrollIntoView({ block: 'nearest' });
    }
  }
}

// ✅ selecteer via boomcode uit de lijst
function selectByCode(codeText) {
  const key = codeText.toLowerCase();
  const m = markersByCode.get(key);
  if (!m) return;

  clearSelection();
  selectedMarker = m;
  m.setIcon(treeIconSelected).openPopup();
  map.panTo(m.getLatLng());

  const item = document.querySelector(`[data-tree-code="${cssEscape(key)}"]`);
  if (item) {
    item.classList.add('active');
    selectedItemEl = item;
  }
}

// 🧩 lijstpaneel + filter
function ensureCodePanel() {
  if (document.getElementById('code-panel')) return;

  if (!document.getElementById('code-panel-css')) {
    const css = `
#code-panel{
  position:absolute;right:0;top:0;width:320px;max-width:75vw;height:100%;
  background:#fff;box-shadow:-2px 0 10px rgba(0,0,0,.1);
  display:grid;grid-template-rows:auto 1fr;transition:transform .25s ease;z-index:500
}
#code-panel.collapsed{ transform:translateX(calc(100% - 28px)); }
#code-panel header{
  display:grid;grid-template-columns:32px 1fr;gap:8px;align-items:center;
  padding:8px;border-bottom:1px solid #eee
}
#code-toggle{ width:28px;height:28px;border:0;border-radius:6px;background:#f2f5f2;cursor:pointer;font-size:14px }
#code-list{ margin:0;padding:8px;overflow:auto;list-style:none }
#code-panel.collapsed #code-list, #code-panel.collapsed #code-filter{ display:none }
#code-list li{ margin:0 0 6px 0 }
#code-list li button{ width:100%; text-align:left; border:0; background:#f6f8f6; padding:8px 10px; border-radius:8px; cursor:pointer }
#code-list li button.active{ outline:2px solid #1f7a3f }
    `.trim();
    const style = document.createElement('style');
    style.id = 'code-panel-css';
    style.textContent = css;
    document.head.appendChild(style);
  }

  const panel = document.createElement('div');
  panel.id = 'code-panel';
  panel.innerHTML = `
    <header>
      <button id="code-toggle" type="button" aria-expanded="true" title="${text.panelCollapse}">⟨</button>
      <div>${text.panelHeading}</div>
      <input id="code-filter" placeholder="${text.filterPlaceholder}">
    </header>
    <ul id="code-list"></ul>
  `;
  document.body.appendChild(panel);

  document.getElementById('code-filter').addEventListener('input', onFilterCodes);

  const toggle = document.getElementById('code-toggle');
  toggle.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    const isOpen = !panel.classList.contains('collapsed');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.title = isOpen ? text.panelCollapse : text.panelExpand;
    toggle.textContent = isOpen ? '⟨' : '⟩';
  });
}

function onFilterCodes(e) {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#code-list li').forEach(li => {
    const hay = (li.getAttribute('data-haystack') || '').toLowerCase();
    li.style.display = hay.includes(q) ? '' : 'none';
  });
}

function renderCodeList(rows) {
  ensureCodePanel();
  const ul = document.getElementById('code-list');
  if (!ul) return;

  ul.innerHTML = '';
  clearSelection();

  const items = [];
  const seen = new Set();
  rows.forEach(r => {
    const code = (r.tree_code || '').trim();
    if (!code) return;
    const key = code.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);

    const name = (r.tree_name || '').trim();
    items.push({ code, name });
  });

  if (!items.length) {
    ul.innerHTML = `<div class="empty">${text.noTreeCodes}</div>`;
    return;
  }

  items.sort((a, b) => a.code.localeCompare(b.code, text.intlLocale));

  const frag = document.createDocumentFragment();
  items.forEach(({ code, name }) => {
    const li = document.createElement('li');
    li.setAttribute('data-haystack', `${code} ${name}`);

    const btn = document.createElement('button');
    btn.type = 'button';
    const display = name ? `${code} — ${name}` : code;
    btn.textContent = display;
    btn.setAttribute('data-tree-code', code.toLowerCase());
    btn.addEventListener('click', () => selectByCode(code));

    li.appendChild(btn);
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}

function cssEscape(s) {
  return s.replace(/["\\]/g, '\\$&');
}

// 🎛️ Form submit listener
document.getElementById('finder').addEventListener('submit', async e => {
  e.preventDefault();
  const q = document.getElementById('email').value.trim();

  if (!q) {
    msg.textContent = text.enterQuery;
    renderCodeList([]);
    markers.clearLayers();
    return;
  }

  msg.textContent = text.loading;

  try {
    const data = await fetchTrees(q);
    const rows = Array.isArray(data) ? data : (data.rows || []);
    renderTrees(rows);
  } catch (err) {
    console.error("API error:", err);
    msg.textContent = text.loadTreesError;
    renderCodeList([]);
    markers.clearLayers();
  }
});

// ——— Forest Heroes: batching met after_id ———
async function fetchForestHeroesBatch(limit = 500, afterId = null) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (afterId) qs.set('after_id', String(afterId));

  const res = await fetch(`https://ptb-tree-map.onrender.com/api/forest-heroes?${qs}`, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(text.serverError(res.status));
  return res.json();
}

async function loadAllForestHeroes(limit = 500) {
  markers.clearLayers();
  markersByCode.clear();
  clearSelection();
  ensureCodePanel();

  let after = null;
  let total = 0;
  const allRows = [];
  const bounds = [];

  for (;;) {
    const { rows, next_after_id } = await fetchForestHeroesBatch(limit, after);
    if (!rows || !rows.length) break;

    rows.forEach(r => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.long);
      if (isNaN(lat) || isNaN(lng)) return;

      const code = (r.tree_code || '').trim();
      const name = (r.tree_name || '').trim();
      const type = r.tree_type || '';
      const area = r.area || '';
      const planted = r.planted_date ? new Date(r.planted_date).toLocaleDateString(text.intlLocale) : '';
      const gmaps = `https://maps.google.com/?q=${lat},${lng}`;

      const nameRow = name ? `<div class="popup-line"><strong>${text.nameLabel}</strong> ${name}</div>` : '';

      const popup =
        `<div class="popup">
           <div class="popup-title">${code || text.treeFallback}</div>
           ${nameRow}
           <div class="popup-sub">${type} ${area ? '• ' + area : ''}</div>
           <div class="popup-meta">${planted}</div>
           <div class="popup-actions">
             <button class="btn-link" onclick="navigator.clipboard.writeText('${code || ''}')">${text.copyCode}</button>
             <a class="btn-link" href="${gmaps}" target="_blank" rel="noopener">${text.openMaps}</a>
           </div>
         </div>`;

      const m = L.marker([lat, lng], { icon: treeIcon }).bindPopup(popup);
      m.on('click', () => selectByMarker(m, code));
      markers.addLayer(m);
      bounds.push([lat, lng]);
      if (code) markersByCode.set(code.toLowerCase(), m);
    });

    allRows.push(...rows);
    total += rows.length;
    if (msg) msg.textContent = text.treesLoaded(total);

    if (!next_after_id || rows.length < limit) break;
    after = next_after_id;
  }

  if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
  renderCodeList(allRows);
  msg.textContent = text.treesTotal(allRows.length);
}

// 🔘 knop: toon forest heroes
const heroesBtn = document.getElementById('show-heroes');
if (heroesBtn) {
  heroesBtn.addEventListener('click', async () => {
    try {
      msg.textContent = text.loading;
      await loadAllForestHeroes(500);
    } catch (err) {
      console.error('Unable to load Forest Heroes:', err);
      msg.textContent = text.loadHeroesError;
      renderCodeList([]);
      markers.clearLayers();
    }
  });
}

// 🔗 Deep-link support + doneren-knop in bovenbalk + klikbaar header-logo
window.addEventListener('DOMContentLoaded', () => {
  try {
    // 1) doneren-knop naast "toon forest heroes"
    if (heroesBtn && !document.getElementById('donate-inline')) {
      if (!document.getElementById('donate-inline-css')) {
        const style = document.createElement('style');
        style.id = 'donate-inline-css';
        style.textContent = `
.donate-inline-btn{
  background:#45b910;
  color:#fff;
  border:none;
  border-radius:999px;
  padding:8px 16px;
  margin-left:8px;
  cursor:pointer;
  font-weight:700;
  font-size:14px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  animation:donate-wiggle 3s ease-in-out infinite;
}
.donate-inline-btn:hover{ filter:brightness(1.05); }
@keyframes donate-wiggle{
  0%,100%{ transform:translateX(0); }
  3% { transform:translateX(-1px); }
  6% { transform:translateX(1px); }
  9% { transform:translateX(-1px); }
  12%{ transform:translateX(0); }
}
@media (prefers-reduced-motion: reduce){
  .donate-inline-btn{ animation:none; }
}
        `.trim();
        document.head.appendChild(style);
      }

      const donateBtn = document.createElement('button');
      donateBtn.id = 'donate-inline';
      donateBtn.type = 'button';
      donateBtn.className = 'donate-inline-btn';
      donateBtn.textContent = text.donate;

      heroesBtn.insertAdjacentElement('afterend', donateBtn);

      donateBtn.addEventListener('click', () => {
        window.location.href = text.donateUrl;
      });
    }

    // 2) header-logo in bovenbalk klikbaar maken
    const headerLogo =
      document.querySelector('img[alt="Plant N Boom"]:not(.map-logo)') ||
      document.querySelector('.top-logo, .header-logo, .brand-logo');

    if (headerLogo) {
      headerLogo.style.cursor = 'pointer';
      headerLogo.addEventListener('click', () => {
        window.location.href = text.homeUrl;
      });
    }

    // 3) deep-link: ?user_id= / ?id= / ?email= / ?q=
    const params = new URLSearchParams(window.location.search);

    const deepLinkValue =
      params.get('user_id') ||
      params.get('id') ||
      params.get('email') ||
      params.get('q');

    if (deepLinkValue) {
      const input = document.querySelector('#email');
      const form  = document.querySelector('#finder');

      if (input && form) {
        input.value = deepLinkValue.trim();
        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
        } else {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      }
    }
  } catch (e) {
    console.warn('Init (deep-link / donate / logo) failed:', e);
  }
});
