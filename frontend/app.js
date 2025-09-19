const map = L.map('map').setView([8.5, -13.2], 7);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const markers = L.layerGroup().addTo(map);
const msg = document.getElementById('msg');

async function fetchTrees(query) {
  const baseUrl = "https://ptb-tree-map.onrender.com/api/trees";
  const url = new URL(baseUrl);

  if (query.includes('@')) url.searchParams.set('email', query.trim());
  else url.searchParams.set('user_id', query.trim());

  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('serverfout ' + res.status);
  return res.json();
}

function renderTrees(rows) {
  markers.clearLayers();
  if (!rows.length) { msg.textContent = '0 bomen gevonden'; return; }

  const bounds = [];
  rows.forEach(r => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.long);
    if (isNaN(lat) || isNaN(lng)) return;

    const m = L.marker([lat, lng]).bindPopup(
      `<strong>${r.tree_code}</strong><br>${r.tree_type || ''}<br>${r.area || ''}`
    );
    markers.addLayer(m);
    bounds.push([lat, lng]);
  });

  if (bounds.length) map.fitBounds(bounds, { padding: [20,20] });
  msg.textContent = `${rows.length} bomen`;
}

document.getElementById('finder').addEventListener('submit', async e => {
  e.preventDefault();
  const q = document.getElementById('email').value.trim();
  if (!q) { msg.textContent = 'voer e-mail of user_id in'; return; }
  msg.textContent = 'laden…';
  try {
    const data = await fetchTrees(q);
    const rows = Array.isArray(data) ? data : (data.rows || []);
    renderTrees(rows);
  } catch (err) {
    console.error(err);
    msg.textContent = 'kan bomen niet laden';
  }
});
