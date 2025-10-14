// 🌍 Init map 
const map = L.map('map').setView([8.5, -13.2], 7); // Sierra Leone default view
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 📍 Marker layer
const markers = L.layerGroup().addTo(map);
const msg = document.getElementById('msg');

// 📦 state voor selectie en mapping
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

// 🔎 Fetch trees by email or user_id (ongewijzigd)
async function fetchTrees(query) {
  const baseUrl = "https://ptb-tree-map.onrender.com/api/trees"; // 👈 API op Render
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
  ensureCodePanel(); // maak of toon de panel

  if (!rows.length) {
    msg.textContent = '0 bomen gevonden';
    renderCodeList([]); // leegmaken
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
    const type = r.tree_type || '';
    const area = r.area || '';
    const planted = r.planted_date ? new Date(r.planted_date).toLocaleDateString() : '';

    const m = L.marker([lat, lng], { icon: defaultIcon }).bindPopup(
      `<strong>${code || 'boom'}</strong><br>` +
      `${type}<br>` +
      `${area}<br>` +
      `${planted}`
    );

    // klik op marker → selecteer in lijst en kleur rood
    m.on('click', () => selectByMarker(m, code));

    markers.addLayer(m);
    bounds.push([lat, lng]);

    if (code) {
      // map op lowercase zodat klikken ongevoelig is voor hoofdletters
      markersByCode.set(code.toLowerCase(), m);
    }
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }

  msg.textContent = `${rows.length} bomen`;

  // lijst vullen
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
    // markeer bijbehorende item in lijst
    const item = document.querySelector(`[data-tree-code="${cssEscape(codeText.toLowerCase())}"]`);
    if (item) {
      item.classList.add('active');
      selectedItemEl = item;
      // scroll item in zicht
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

// 🧩 lijstpaneel maken als die nog niet bestaat
function ensureCodePanel() {
  if (document.getElementById('code-panel')) return;

  const style = document.createElement('style');
  style.textContent = `
    #code-panel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: 280px;
      max-height: 40vh;
      overflow: auto;
      background: #fff;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 10px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.15);
      font: 14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      z-index: 800; /* boven de kaart */
    }
    #code-panel header {
      position: sticky;
      top: 0;
      background: #fff;
      padding: 8px 12px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      font-weight: 600;
    }
    #code-list {
      list-style: none;
      margin: 0;
      padding: 8px;
    }
    #code-list li {
      margin: 0;
      padding: 0;
    }
    #code-list button {
      width: 100%;
      text-align: left;
      padding: 8px 10px;
      border: 0;
      background: transparent;
      cursor: pointer;
      border-radius: 6px;
    }
    #code-list button:hover { background: #f2f4f7; }
    #code-list button.active {
      background: #e6f0ff;
      outline: 2px solid #99bfff;
    }
    #code-panel .empty { padding: 10px 12px; color: #666; }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('div');
  panel.id = 'code-panel';
  panel.innerHTML = `
    <header>Boomcodes</header>
    <ul id="code-list"></ul>
  `;
  document.body.appendChild(panel);
}

// 🗂️ lijst vullen
function renderCodeList(rows) {
  ensureCodePanel();
  const ul = document.getElementById('code-list');
  if (!ul) return;

  ul.innerHTML = '';
  clearSelection();

  // verzamel unieke codes
  const codes = [];
  const seen = new Set();
  rows.forEach(r => {
    const c = (r.tree_code || '').trim();
    if (c && !seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      codes.push(c);
    }
  });

  if (!codes.length) {
    ul.innerHTML = `<div class="empty">Geen boomcodes</div>`;
    return;
  }

  // sorteer alfabetisch
  codes.sort((a, b) => a.localeCompare(b, 'nl'));

  // bouw items
  const frag = document.createDocumentFragment();
  codes.forEach(code => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = code;
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

// 🎛️ Form submit listener (ongewijzigd behalve kleine tekst)
document.getElementById('finder').addEventListener('submit', async e => {
  e.preventDefault();
  const q = document.getElementById('email').value.trim();

  if (!q) {
    msg.textContent = 'voer e-mail of user_id in';
    renderCodeList([]); // leegmaken als niets gezocht wordt
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
