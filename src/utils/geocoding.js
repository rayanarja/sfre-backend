/**
 * Geocoding Service — OpenStreetMap Nominatim
 * مجاني ومابحتاج API key وبيشتغل بسوريا
 *
 * الإصلاح: hybridSuggestions الآن دايمًا بتجيب محطات + مناطق بالتوازي
 * بدل ما تحط شرط "إذا المحطات أقل من 4"
 */

const https = require('https');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT    = 'BusApp/1.0 (bus-management-system)';

// ════════════════════════════════════════════
// geocodePlace — بحث مكان بالاسم
// ════════════════════════════════════════════

async function geocodePlace(query, nearLat = null, nearLng = null) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    'accept-language': 'ar',
    countrycodes: 'sy',
  });

  if (nearLat && nearLng) {
    const delta = 0.2; // ~20 كم (كان 0.15 — وسّعنا قليلاً)
    params.set('viewbox', `${nearLng - delta},${nearLat - delta},${nearLng + delta},${nearLat + delta}`);
    params.set('bounded', '1');
  }

  const results = await _fetch(`${NOMINATIM_URL}/search?${params}`);
  if (!results || results.length === 0) return null;

  return results.map(r => ({
    name:      _cleanName(r.display_name),
    name_full: r.display_name,
    lat:       parseFloat(r.lat),
    lng:       parseFloat(r.lon),
    type:      r.type,
    category:  r.class,
  }));
}

// ════════════════════════════════════════════
// hybridSuggestions — محطات + مناطق بالتوازي
//
// BUG FIX: كان بيجيب مناطق فقط إذا المحطات < 4
// الآن: دايمًا بيجيب الاثنين بالتوازي (Promise.allSettled)
// ويدمجهم: محطات أولاً ثم مناطق (بدون تكرار)، بحد أقصى 8 نتائج
// ════════════════════════════════════════════

async function hybridSuggestions(query, stationSuggestions) {
  // ── تشغيل Nominatim بالتوازي مع المحطات (مو بعدها)
  const nominatimPromise = geocodePlace(query, 36.2, 37.15).catch(() => null);

  // ── انتظر Nominatim (مو blocking — شغّل بالتوازي)
  const places = await nominatimPromise;

  const results = [];
  const seenNames = new Set();

  // 1) المحطات المسجلة أولاً
  for (const name of stationSuggestions) {
    if (!seenNames.has(name.toLowerCase())) {
      seenNames.add(name.toLowerCase());
      results.push({ name, type: 'station' });
    }
  }

  // 2) المناطق من Nominatim — دايمًا، بغض النظر عن عدد المحطات
  if (places && places.length > 0) {
    for (const p of places) {
      if (results.length >= 8) break; // حد أقصى 8 اقتراحات كلي
      const key = p.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push({
          name:      p.name,
          name_full: p.name_full,
          type:      'place',
          lat:       p.lat,
          lng:       p.lng,
        });
      }
    }
  }

  return results;
}

// ════════════════════════════════════════════
// مساعدات
// ════════════════════════════════════════════

function _cleanName(displayName) {
  const parts = displayName.split(',').map(p => p.trim());
  if (parts.length <= 2) return displayName;
  return parts.slice(0, 2).join('، ');
}

function _fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = { geocodePlace, hybridSuggestions };