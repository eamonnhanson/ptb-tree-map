// 🔎 batch-fetch forest heroes (keyset)
async function fetchForestHeroesBatch(limit = 500, afterId = null) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (afterId) qs.set('after_id', String(afterId));

  const res = await fetch(`https://ptb-tree-map.onrender.com/api/forest-heroes?${qs}`, {
    headers: { Accept: 'application/json' }
  });
  if (!res.ok) throw new Error('serverfout ' + res.status);
  return res.json(); // { rows, next_after_id }
}

// ➕ markers toevoegen zonder alles te wissen
function addMarkersFromRows(rows, boundsAcc = []) {
  rows.forEach(r => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.long);
    if (isNaN(lat) || isNaN(lng)) return;

    const code = (r.tree_code || '').trim();
    const type = r.tree_type || '';
    const area = r.area || '';
    const planted = r.planted_date ? new Date(r.planted_date).toLocaleDateString('nl-NL') : '';
    const gmaps = `https://maps.google.com/?q=${lat},${lng}`;

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
    boundsAcc.push([lat, lng]);
    if (code) markersByCode.set(code.toLowerCase(), m);
  });
}

// 🚚 alles laden in batches met progress
async function loadAllForestHeroes(limit = 500) {
  // reset
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
    if (rows.length) {
      addMarkersFromRows(rows, bounds);
      allRows.push(...rows);
      total += rows.length;
      if (msg) msg.textContent = `${total} bomen`;
    }
    if (!next_after_id || rows.length < limit) break;
    after = next_after_id;
  }

  if (bounds.length) map.fitBounds(bounds, { padding: [20, 20] });
  renderCodeList(allRows); // lijst pas op het einde
}

// 🆕 knop: toon forest heroes (vervang je oude handler)
const heroesBtn = document.getElementById('show-heroes');
if (heroesBtn) {
  heroesBtn.addEventListener('click', async () => {
    try {
      msg.textContent = 'laden…';
      await loadAllForestHeroes(500); // pas aan als je kleinere batches wilt
    } catch (err) {
      console.error('kan Forest Heroes niet laden:', err);
      msg.textContent = 'kan Forest Heroes niet laden';
      renderCodeList([]);
      markers.clearLayers();
    }
  });
}
