/**
 * Geocoding Service — OpenStreetMap Nominatim
 * مجاني ومابحتاج API key وبيشتغل بسوريا
 * 
 * الاستخدام:
 *   geocodePlace('جامعة حلب')  →  { lat: 36.21, lng: 37.12, display_name: '...' }
 *   searchPlaces('مستشفى', 36.2, 37.1)  →  [{ name, lat, lng }, ...]
 */

const https = require('https');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'BusApp/1.0 (bus-management-system)';

/**
 * بحث عن مكان بالاسم — يرجع أول نتيجة
 */
async function geocodePlace(query, nearLat = null, nearLng = null) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '5',
    'accept-language': 'ar',
    countrycodes: 'sy',
  });

  // إذا عندنا موقع الراكب — حدد نطاق البحث حوله
  if (nearLat && nearLng) {
    const delta = 0.15; // ~15 كم
    params.set('viewbox', `${nearLng - delta},${nearLat - delta},${nearLng + delta},${nearLat + delta}`);
    params.set('bounded', '1');
  }

  const results = await _fetch(`${NOMINATIM_URL}/search?${params}`);
  if (!results || results.length === 0) return null;

  return results.map(r => ({
    name: _cleanName(r.display_name),
    name_full: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    type: r.type,
    category: r.class,
  }));
}

/**
 * بحث مختلط — محطات + أماكن
 * يرجع اقتراحات من نوعين:
 *   { name, type: 'station' }  — محطة موجودة بالنظام
 *   { name, type: 'place', lat, lng }  — مكان من الخريطة
 */
async function hybridSuggestions(query, stationSuggestions) {
  const results = [];

  // أولاً: المحطات المسجلة
  for (const name of stationSuggestions) {
    results.push({ name, type: 'station' });
  }

  // ثانياً: أماكن من Nominatim (إذا المحطات قليلة)
  if (stationSuggestions.length < 4) {
    try {
      // حدود حلب التقريبية
      const places = await geocodePlace(query, 36.2, 37.15);
      if (places) {
        for (const p of places.slice(0, 4 - stationSuggestions.length)) {
          // تأكد ما يكون مكرر
          if (!results.find(r => r.name === p.name)) {
            results.push({
              name: p.name,
              name_full: p.name_full,
              type: 'place',
              lat: p.lat,
              lng: p.lng,
            });
          }
        }
      }
    } catch (e) {
      // Nominatim فشل — رجّع المحطات بس
    }
  }

  return results;
}

/**
 * نظّف اسم المكان — شيل التفاصيل الزيادة
 */
function _cleanName(displayName) {
  // "جامعة حلب, حلب, محافظة حلب, سوريا" → "جامعة حلب, حلب"
  const parts = displayName.split(',').map(p => p.trim());
  if (parts.length <= 2) return displayName;
  return parts.slice(0, 2).join('، ');
}

/**
 * HTTP GET — لأنو Nominatim بحتاج HTTPS
 */
function _fetch(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': USER_AGENT }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

module.exports = { geocodePlace, hybridSuggestions };
