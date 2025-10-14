window.addEventListener('DOMContentLoaded', () => {
  // elementen ophalen
  const form = document.getElementById('finder');
  const msg  = document.getElementById('msg');
  const inputIdentity = document.getElementById('email');     // e-mail of user_id
  const inputTreeCode = document.getElementById('tree_code'); // tree_code
  const mapEl = document.getElementById('map');

  // basischecks
  if (!mapEl) {
    console.error('map element (#map) ontbreekt in HTML');
    return;
  }
  if (!form) {
    console.error('form element (#finder) ontbreekt in HTML');
    return;
  }
  if (!msg) {
    console.warn('msg element (#msg) ontbreekt, fallback naar console');
  }

  // 🌍 kaart initialiseren
  const map = L.map('map').setView([8.5, -13.2], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  // 📍 markerlaag
  const markers = L.layerGroup().addTo(map);

  // hulpfuncties
  const setMsg = t => { if (msg) msg.textContent = t; else console.log('[msg]', t); };
  const hardTrim = s => (s || '').replace(/^\s+|\s+$/g, '').replace(/\u00A0/g, ' ').trim();

  // 🔎 data ophalen
  async function fetchTrees({ identity, treeCode }) {
    const baseUrl = "https://ptb-tree-map.onrender.com/api/trees";
    const url = new URL(baseUrl);

    const idVal = hardTrim(identity || '');
    const code  = hardTrim(treeCode || '').toLowerCase();

    if (code) {
      url.searchParams.set('tree_code', code);
    } else if (idVal.includes('@')) {
      url.searchParams.set('email', idVal);
    } else if (/^\d+$/.test(idVal)) {
      url.searchParams.set('user_id', idVal);
    } else {
      throw new Error('ongeldige invoer');
    }

    console.log('[finder] url:', url.toString());

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error('serverfout ' + res.status);
    return res.json();
  }

  // 🖼️ markers tekenen
  function renderTrees(rows) {
    markers.clearLayers();

    if (!rows || !rows.length) {
      setMsg('0 bomen gevonden');
      return;
    }

    const bounds = [];
    let shown = 0;

    rows.forEach(r => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.long);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        console.warn('Skipping invalid coords:', r);
        return;
      }

      const popup =
        `<strong>${r.tree_code || 'boom'}</strong><br>` +
        `${r.tree_type || ''}<br>` +
        `${r.area || ''}<br>` +
        `${r.planted_date ? new Date(r.planted_date).toLocaleDateString() : ''}`;

      markers.addLayer(L.marker([lat, lng]).bindPopup(popup));
      bounds.push([lat, lng]);
      shown++;
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
    setMsg(`${shown} bomen`);
  }

  // 🎛️ submit handler
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const identity = inputIdentity ? inputIdentity.value : '';
    const treeCode = inputTreeCode ? inputTreeCode.value : '';

    if (!hardTrim(identity) && !hardTrim(treeCode)) {
      setMsg('vul e-mail of user_id in, of vul tree_code in');
      return;
    }

    setMsg('laden…');

    try {
      const data = await fetchTrees({ identity, treeCode });
      const rows = Array.isArray(data) ? data : (data.rows || []);
      console.log('[finder] raw response:', data);
      renderTrees(rows);
    } catch (err) {
      console.error('API error:', err);
      setMsg(String(err.message).includes('ongeldige invoer')
        ? 'ongeldige invoer. gebruik e-mail, numerieke user_id of tree_code'
        : 'kan bomen niet laden');
    }
  });

  // kaart is zichtbaar, laat een beginstatus zien
  setMsg('voer e-mail/user_id of tree_code in');
});
