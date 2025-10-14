// 🌍 Init map 
const map = L.map('map').setView([8.5, -13.2], 7); // Sierra Leone default view
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

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
    const type = r.tree_type || '';
    const area = r.area || '';
    const planted = r.planted_date ? new Date(r.planted_date).toLocaleDateString('nl-NL') : '';
    const gmaps = `https://maps.google.com/?q=${lat},${lng}`;

    // nette popup met knoppen
    const popup =
      `<div class="popup">
         <div class="popup-title">${code || 'boom'}</div>
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
    const item = document.querySelector(`[data-tree-code="${cssEscape(codeText.toLowerCase())}"]`);
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

function onFilterCodes(e) {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('#code-list button').forEach(btn => {
    const match = btn.textContent.toLowerCase().includes(q);
    btn.parentElement.style.display = match ? '' : 'none';
  });
}

// 🗂️ lijst vullen
function renderCodeList(rows) {
  ensureCodePanel();
  const ul = document.getElementById('code-list');
  if (!ul) return;

  ul.innerHTML = '';
  clearSelection();

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

  codes.sort((a, b) => a.localeCompare(b, 'nl'));

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
