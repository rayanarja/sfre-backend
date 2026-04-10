/**
 * ═══════════════════════════════════════════════
 * Geo Utilities — دوال المسافة والإحداثيات
 * ═══════════════════════════════════════════════
 */

/**
 * حساب المسافة بين نقطتين (Haversine) بالمتر
 * @param {number} lat1 - خط العرض الأول
 * @param {number} lon1 - خط الطول الأول
 * @param {number} lat2 - خط العرض الثاني
 * @param {number} lon2 - خط الطول الثاني
 * @returns {number} المسافة بالمتر
 */
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // نصف قطر الأرض بالمتر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * لاقي أقرب محطة لموقع معين
 * @param {Array} stations - قائمة المحطات (كل محطة عندها lat, lng)
 * @param {number} lat - خط العرض
 * @param {number} lng - خط الطول
 * @returns {{ station: object, distance: number } | null}
 */
function findNearestStation(stations, lat, lng) {
  let nearest = null;
  let minDist = Infinity;
  for (const s of stations) {
    if (s.lat == null || s.lng == null) continue;
    const d = getDistance(lat, lng, s.lat, s.lng);
    if (d < minDist) {
      minDist = d;
      nearest = s;
    }
  }
  return nearest ? { station: nearest, distance: minDist } : null;
}

module.exports = { getDistance, findNearestStation };
