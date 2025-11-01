// 🌍 Init map
const map = L.map('map').setView([8.5, -13.2], 7);

// 🧱 basemaps
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const esriSat = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri'
  }
);

// 🧭 layers control (rechtsboven)
L.control.layers(
  { 'Kaart (OSM)': osm, 'Satelliet (Esri)': esriSat },
  {}, // overlays heb je al via markers-laag
  { position: 'topright', collapsed: true }
).addTo(map);

// 📏 schaalbalk (linksonder)
L.control.scale({ imperial: false, maxWidth: 120 }).addTo(map);

// 🟩 logo als Leaflet control (linksonder)
const LogoControl = L.Control.extend({
  options: { position: 'bottomleft' },
  onAdd() {
    const img = L.DomUtil.create('img', 'map-logo');
    img.src = 'https://www.planteenboom.nu/cdn/shop/files/plant_N_boom_logo_2000_1500_rectangle.png?v=1658947367&width=140';
    img.alt = 'Plant N Boom';
    img.title = 'Plant N Boom';
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => window.open('https://www.planteenboom.nu/', '_blank'));
    return img;
  }
});
new LogoControl().addTo(map);

// 📍 Marker layer
const markers = L.layerGroup().addTo(map);
const msg = document.getElementById('msg');

// 📦 state
const markersByCode = new Map();
let selectedMarker = null;
let selectedItemEl = null;

// 🎨 iconen
const defaultIcon = new L.Icon.Default();
const redIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
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

// 🔎 Fetch alle Forest Heroes (abonnees) – nieuw
async function fetchForestHeroes() {
  const url = "https://ptb-tree-map.onrender.com/api/forest-heroes"; // server-endpoint vereist
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
    const name = (r.tree_name || '').trim();   // ⬅️ boomnaam meenemen
    const type = r.tree_type || '';
    const area = r.area || '';
    const planted = r.planted_date ? new Date(r.planted_date).toLocaleDateString('nl-NL') : '';
    const gmaps = `https://maps.google.com/?q=${lat},${lng}`;

    const nameRow = name ? `<div class="popup-line"><strong>Naam:</strong> ${name}</div>` : '';

    // nette popup met knoppen
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

    const m = L.marker([lat, lng], { icon: defaultIcon }).bindPopup(popup);

    m.on('click', () => selectByMarker(m, code));

    markers.addLayer(m);
    bounds.push([lat, lng]);

    if (code) markersByCode.set(code.toLowerCase(), m);
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });

  msg.textContent = `${rows.length} bomen`;
  renderCodeList(rows);
}

// 🧼 selectie wissen
function clearSelection() {
  if (selectedMarker) {
    selectedMarker.setIcon(defaultIcon);
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
  marker.setIcon(redIcon).openPopup();
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
  m.setIcon(redIcon).openPopup();
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
  const panel = document.createElement('div');
  panel.id = 'code-panel';
  panel.innerHTML = `
    <header>
      Boomcodes
      <input id="code-filter" placeholder="filter">
    </header>
    <ul id="code-list"></ul>
  `;
  document.body.appendChild(panel);
  document.getElementById('code-filter').addEventListener('input', onFilterCodes);
}

// 🔎 filter werkt nu op code + naam
function onFilterCodes(e) {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#code-list li').forEach(li => {
    const hay = (li.getAttribute('data-haystack') || '').toLowerCase();
    li.style.display = hay.includes(q) ? '' : 'none';
  });
}

// 🗂️ lijst vullen — met code — naam (naam optioneel)
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

    const name = (r.tree_name || '').trim(); // kan leeg zijn
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
    // haystack = waar de filter op zoekt (code + naam)
    li.setAttribute('data-haystack', `${code} ${name}`);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name ? `${code} — ${name}` : code;
    btn.setAttribute('data-tree-code', code.toLowerCase());
    btn.addEventListener('click', () => selectByCode(code));

    li.appendChild(btn);
    frag.appendChild(li);
  });
  ul.appendChild(frag);
}

// veilige selector escape
function cssEscape(s) {
  return s.replace(/["\\]/g, '\\$&');
}

// 🎛️ Form submit listener (e-mail of user_id)
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

// 🆕 Knop: toon alle Forest Heroes
const heroesBtn = document.getElementById('show-heroes');
if (heroesBtn) {
  heroesBtn.addEventListener('click', async () => {
    msg.textContent = 'laden…';
    try {
      const data = await fetchForestHeroes();
      const rows = Array.isArray(data) ? data : (data.rows || []);
      renderTrees(rows);
    } catch (err) {
      console.error(err);
      msg.textContent = 'kan Forest Heroes niet laden';
      renderCodeList([]);
      markers.clearLayers();
    }
  });
}

// 🔗 Deep-link support: /forest?id=3354  (of ?email=.. / ?q=..)
window.addEventListener('DOMContentLoaded', () => {
  try {
    const params = new URLSearchParams(window.location.search);

    // accepteer id, email of q als queryparam
    const deepLinkValue =
      params.get('id') ||
      params.get('email') ||
      params.get('q');

    if (deepLinkValue) {
      const input = document.querySelector('#email');
      const form  = document.querySelector('#finder');

      if (input && form) {
        input.value = deepLinkValue.trim();

        // netjes submitten (requestSubmit waar beschikbaar)
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
