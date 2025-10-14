// 🌍 Init map 
const map = L.map('map').setView([8.5, -13.2], 7); // Sierra Leone default view
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 📍 Marker layer
const markers = L.layerGroup().addTo(map);
const msg = document.getElementById('msg');

// 🔎 Fetch trees via email/user_id of tree_code
async function fetchTrees({ identity, treeCode }) {
  const baseUrl = "https://ptb-tree-map.onrender.com/api/trees";
  const url = new URL(baseUrl);

  const emailOrUser = (identity || "").trim();
  const code = (treeCode || "").trim().toLowerCase();

  if (code) {
    url.searchParams.set('tree_code', code);
  } else if (emailOrUser.includes('@')) {
    url.searchParams.set('email', emailOrUser);
  } else if (/^\d+$/.test(emailOrUser)) {
    url.searchParams.set('user_id', emailOrUser);
  } else {
    throw new Error('ongeldige invoer');
  }

  console.log('[finder] url:', url.toString());

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('serverfout ' + res.status);

  return res.json();
}

// 🖼️ Render markers on map
function renderTrees(rows) {
  markers.clearLayers();

  if (!rows.length) {
    msg.textContent = '0 bomen gevonden';
    return;
  }

  const bounds = [];
  rows.forEach(r => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.long);

    console.log("Row:", r);
    console.log("Parsed coords:", lat, lng);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn("Skipping invalid coords:", r);
      return;
    }

    const m = L.marker([lat, lng]).bindPopup(
      `<strong>${r.tree_code || 'boom'}</strong><br>` +
      `${r.tree_type || ''}<br>` +
      `${r.area || ''}<br>` +
      `${r.planted_date ? new Date(r.planted_date).toLocaleDateString() : ''}`
    );
    markers.addLayer(m);
    bounds.push([lat, lng]);
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [20, 20] });
    console.log("Fitted map to bounds:", bounds);
  }

  msg.textContent = `${rows.length} bomen`;
}

// 🎛️ Form submit listener
document.getElementById('finder').addEventListener('submit', async e => {
  e.preventDefault();

  const identity = document.getElementById('email')?.value?.trim() || '';
  const treeCode = document.getElementById('tree_code')?.value?.trim() || '';

  if (!identity && !treeCode) {
    msg.textContent = 'vul e-mail of user_id in, of vul tree_code in';
    return;
  }

  msg.textContent = 'laden…';

  try {
    const data = await fetchTrees({ identity, treeCode });
    const rows = Array.isArray(data) ? data : (data.rows || []);
    renderTrees(rows);
  } catch (err) {
    console.error("API error:", err);
    if (String(err.message).includes('ongeldige invoer')) {
      msg.textContent = 'ongeldige invoer. gebruik e-mail, numerieke user_id of tree_code';
    } else {
      msg.textContent = 'kan bomen niet laden';
    }
  }
});
