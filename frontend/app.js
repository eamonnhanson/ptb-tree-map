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
  { 'Kaart (OSM)': osm, 'Satelliet (Esri)': esriSat },
  {},
  { position: 'topright', collapsed: true }
).addTo(map);

// 📏 schaalbalk (linksonder)
L.control.scale({ imperial: false, maxWidth: 120 }).addTo(map);

// 🟩 logo als Leaflet control (LINKSboven, klik naar homepage)
const LogoControl = L.Control.extend({
  options: { position: 'topleft' },
  onAdd() {
    const img = L.DomUtil.create('img', 'map-logo');
    img.src = 'https://www.planteenboom.nu/cdn/shop/files/plant_N_boom_logo_2000_1500_rectangle.png?v=1658947367&width=140';
    img.alt = 'Plant N Boom';
    img.title = 'Plant N Boom';
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      window.location.href = 'https://www.planteenboom.nu/';
    });
    return img;
  }
});
new LogoControl().addTo(map);

// 💚 doneren-knop rechtsboven
const DonateControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd() {
    const btn = L.DomUtil.create('button', 'donate-btn');
    btn.type = 'button';
    btn.textContent = 'doneren';
    btn.style.background = '#45b910';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '999px';
    btn.style.padding = '6px 14px';
    btn.style.marginLeft = '8px';
    btn.style.cursor = 'pointer';
    btn.style.fontWeight = '700';
    L.DomEvent.disableClickPropagation(btn);
    btn.addEventListener('click', () => {
      window.location.href = 'https://www.planteenboom.nu/pages/particulier';
    });
    return btn;
  }
});
new DonateControl().addTo(map);

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
  if (!res.ok) throw new Error('serverfout ' + res.status);
  return res.json();
}

// 🖼️ Render markers on map
function renderTrees(rows) {
  markers.clearLayers();
  markersByCode.clear();
  clearSelection();
  ensureCodePanel();

  if (!rows.length) {
    msg.textContent = '0 bomen gevonden';
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
    const planted = r.planted_date ? new Date(r.planted_date).toLocaleDateString('nl-NL') : '';
    const gmaps = `https://maps.google.com/?q=${lat},${lng}`;

    const nameRow = name ? `<div class="popup-line"><strong>Naam:</strong> ${name}</div>` : '';

    const popup =
      `<div class="popup">
         <div class="popup-title">${code || 'boom'}</div>
         ${nameRow}
         <div class="popup-sub">${type} ${area ? '• ' + area : ''}</div>
         <div class="popup-meta">${planted}</div>
         <div class="popup-actions">
           <button class="btn-link" onclick="navigator.clipboard.writeText('${code || ''}')">kopieer code</button>
           <a class="btn-link" href="${gmaps}" target="_blank" rel="noopener">open in maps</a>
         </div>
       </div>`;

    const m = L.marker([lat, lng], { icon: treeIcon }).bindPopup(popup);
    m.on('click', () => selectByMarker(m, code));
    markers.addLayer(m);
    bounds.push([lat, lng]);

    if (code) markersByCode.set(code.toLowerCase(), m);
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });

  msg.textContent = `${rows.length} bomen`;
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
      <button id="code-toggle" type="button" aria-expanded="true" title="paneel inklappen">⟨</button>
      <div>boomcodes</div>
      <input id="code-filter" placeholder="filter">
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
    ul.innerHTML = `<div class="empty">Geen boomcodes</div>`;
    return;
  }

  items.sort((a, b) => a.code.localeCompare(b.code, 'nl'));

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
    msg.textContent = 'voer e-mail of user_id in';
    renderCodeList([]);
    markers.clearLayers();
    return;
  }

  msg.textContent = 'laden…';

  try {
    const data = await fetchTrees(q);
    const rows = Array.isArray(data) ? data : (data.rows || []);
    renderTrees(rows);
  } catch (err) {
    console.error("API error:", err);
    msg.textContent = 'kan bomen niet laden';
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
  if (!res.ok) throw new Error('serverfout ' + res.status);
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
      const planted = r.planted_date ? new Date(r.planted_date).toLocaleDateString('nl-NL') : '';
      const gmaps = `https://maps.google.com/?q=${lat},${lng}`;

      const nameRow = name ? `<div class="popup-line"><strong>Naam:</strong> ${name}</div>` : '';

      const popup =
        `<div class="popup">
           <div class="popup-title">${code || 'boom'}</div>
           ${nameRow}
           <div class="popup-sub">${type} ${area ? '• ' + area : ''}</div>
           <div class="popup-meta">${planted}</div>
           <div class="popup-actions">
             <button class="btn-link" onclick="navigator.clipboard.writeText('${code || ''}')">kopieer code</button>
             <a class="btn-link" href="${gmaps}" target="_blank" rel="noopener">open in maps</a>
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
    if (msg) msg.textContent = `${total} bomen geladen…`;

    if (!next_after_id || rows.length < limit) break;
    after = next_after_id;
  }

  if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
  renderCodeList(allRows);
  msg.textContent = `${allRows.length} bomen totaal`;
}

// 🔘 knop: toon forest heroes
const heroesBtn = document.getElementById('show-heroes');
if (heroesBtn) {
  heroesBtn.addEventListener('click', async () => {
    try {
      msg.textContent = 'laden…';
      await loadAllForestHeroes(500);
    } catch (err) {
      console.error('kan Forest Heroes niet laden:', err);
      msg.textContent = 'kan Forest Heroes niet laden';
      renderCodeList([]);
      markers.clearLayers();
    }
  });
}

// 🔗 Deep-link support (nu ook ?user_id=)
window.addEventListener('DOMContentLoaded', () => {
  try {
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
    console.warn('Deep-link parse failed:', e);
  }
});
