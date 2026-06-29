const prisma = require('../../config/database');
const { getDistance } = require('../../utils/geo');
const { geocodePlace, hybridSuggestions: geoHybrid } = require('../../utils/geocoding');

// ════════════════════════════════════════════════
// CRUD
// ════════════════════════════════════════════════

const getAllStations = async () => {
  return await prisma.stations.findMany({ include: { route: true } });
};

const getStationById = async (id) => {
  const station = await prisma.stations.findUnique({
    where: { station_id: parseInt(id) },
    include: { route: true },
  });
  if (!station) throw { status: 404, message: 'المحطة غير موجودة' };
  return station;
};

const createStation = async (data) => {
  return await prisma.stations.create({
    data: {
      name:        data.name,
      route_id:    parseInt(data.route_id),
      lat:         data.lat ? parseFloat(data.lat) : null,
      lng:         data.lng ? parseFloat(data.lng) : null,
      order_index: data.order_index ? parseInt(data.order_index) : null,
    },
    include: { route: true },
  });
};

const updateStation = async (id, data) => {
  const updateData = {};
  if (data.name      !== undefined) updateData.name        = data.name;
  if (data.route_id  !== undefined) updateData.route_id    = parseInt(data.route_id);
  if (data.lat       !== undefined) updateData.lat         = data.lat ? parseFloat(data.lat) : null;
  if (data.lng       !== undefined) updateData.lng         = data.lng ? parseFloat(data.lng) : null;
  if (data.order_index !== undefined) updateData.order_index = data.order_index ? parseInt(data.order_index) : null;
  return await prisma.stations.update({
    where: { station_id: parseInt(id) },
    data:  updateData,
    include: { route: true },
  });
};

const deleteStation = async (id) => {
  return await prisma.stations.delete({ where: { station_id: parseInt(id) } });
};

const searchByDestination = async (destination) => {
  return await prisma.stations.findMany({
    where: { name: { contains: destination } },
    include: { route: { include: { buses: true, stations: true } } },
  });
};

// ════════════════════════════════════════════════
// Smart Search
// ════════════════════════════════════════════════

const smartSearch = async (destination, passenger_lat, passenger_lng) => {
  const matchedStations = await prisma.stations.findMany({
    where: { name: { contains: destination } },
    include: {
      route: {
        include: {
          stations: { orderBy: { order_index: 'asc' } },
          buses:    { where: { current_status: 'active' } },
        },
      },
    },
  });

  const routesMap = {};
  for (const station of matchedStations) {
    if (!station.route) continue;
    const routeId = station.route.route_id;
    if (routesMap[routeId]) continue;

    const route        = station.route;
    const allStations  = route.stations;
    const activeBuses  = route.buses;

    let closestStation = null, minDist = Infinity;
    if (passenger_lat && passenger_lng) {
      for (const s of allStations) {
        if (s.lat && s.lng) {
          const dist = getDistance(parseFloat(passenger_lat), parseFloat(passenger_lng), s.lat, s.lng);
          if (dist < minDist) { minDist = dist; closestStation = s; }
        }
      }
    }

    let passengerDirection = null;
    if (closestStation)
      passengerDirection = station.order_index > closestStation.order_index ? 'outbound' : 'inbound';

    const busesInfo = activeBuses.map(bus => {
      const stationsDiff = closestStation
        ? Math.abs((bus.current_station_index || 0) - closestStation.order_index) : null;

      let totalDistance = 0;
      if (closestStation && bus.current_station_index != null) {
        const fromIdx = Math.min(bus.current_station_index, closestStation.order_index);
        const toIdx   = Math.max(bus.current_station_index, closestStation.order_index);
        for (let i = fromIdx; i < toIdx; i++) {
          const s1 = allStations.find(s => s.order_index === i);
          const s2 = allStations.find(s => s.order_index === i + 1);
          if (s1 && s2 && s1.lat && s1.lng && s2.lat && s2.lng)
            totalDistance += getDistance(s1.lat, s1.lng, s2.lat, s2.lng);
        }
      }

      const distanceKm       = totalDistance / 1000;
      const estimatedMinutes = distanceKm > 0 ? Math.max(1, Math.round((distanceKm / 25) * 60)) : null;

      let isIdeal = false;
      if (passengerDirection && bus.direction && closestStation) {
        if (passengerDirection === 'outbound')
          isIdeal = bus.direction === 'outbound' && (bus.current_station_index || 0) <= closestStation.order_index;
        else
          isIdeal = bus.direction === 'inbound'  && (bus.current_station_index || 0) >= closestStation.order_index;
      }

      return {
        bus_id: bus.bus_id, plate_number: bus.plate_number,
        direction: bus.direction, direction_ar: bus.direction === 'outbound' ? 'ذهاب' : 'إياب',
        stations_away: stationsDiff, distance_meters: Math.round(totalDistance),
        estimated_minutes: estimatedMinutes, is_ideal: isIdeal,
      };
    });

    busesInfo.sort((a, b) => {
      if (a.is_ideal && !b.is_ideal) return -1;
      if (!a.is_ideal && b.is_ideal) return 1;
      return (a.stations_away || 999) - (b.stations_away || 999);
    });

    routesMap[routeId] = {
      route_id: route.route_id, route_name: route.route_name,
      matched_station: station.name, matched_station_index: station.order_index,
      stations_count: allStations.length,
      closest_station: closestStation ? {
        name: closestStation.name, order_index: closestStation.order_index,
        distance_meters: Math.round(minDist),
      } : null,
      passenger_direction:    passengerDirection,
      passenger_direction_ar: passengerDirection === 'outbound' ? 'ذهاب'
                            : passengerDirection === 'inbound'  ? 'إياب' : null,
      active_buses:       busesInfo,
      active_buses_count: activeBuses.length,
      best_eta_minutes:   busesInfo.length > 0 ? busesInfo[0].estimated_minutes : null,
    };
  }

  const results = Object.values(routesMap);
  results.sort((a, b) => (a.best_eta_minutes || 999) - (b.best_eta_minutes || 999));
  return results;
};

// ════════════════════════════════════════════════
// اقتراحات المواقف
// ════════════════════════════════════════════════

async function getStationSuggestions(query) {
  const stations = await prisma.stations.findMany({
    where: { name: { contains: query } },
    select: { name: true },
    distinct: ['name'],
    take: 8,
  });
  return stations.map(s => s.name);
}

// ════════════════════════════════════════════════
// اقتراحات مختلطة — محطات + مناطق
// ════════════════════════════════════════════════

async function hybridSuggestions(query) {
  const stationNames = await getStationSuggestions(query);
  try {
    return await geoHybrid(query, stationNames);
  } catch (e) {
    return stationNames.map(name => ({ name, type: 'station' }));
  }
}

// ════════════════════════════════════════════════
// Route Planner v2 — بحث بالمحطات أو المناطق
// ════════════════════════════════════════════════

async function planRouteV2(destination, passengerLat, passengerLng, destLat, destLng) {
  const lat = parseFloat(passengerLat);
  const lng = parseFloat(passengerLng);

  // الحالة 1: إحداثيات مباشرة (اختار منطقة من القائمة)
  if (destLat && destLng) {
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);
    return await _planRouteByCoords(destination, lat, lng, dLat, dLng);
  }

  // الحالة 2: اسم محطة
  const stationResult = await planRoute(destination, passengerLat, passengerLng);
  if (stationResult.plans && stationResult.plans.length > 0) return stationResult;

  // الحالة 3: geocoding — مع راديوس أوسع للمناطق
  try {
    const places = await geocodePlace(destination, lat, lng);
    if (places && places.length > 0) {
      const place  = places[0];
      const result = await _planRouteByCoords(
        destination, lat, lng, place.lat, place.lng,
        { maxWalkFromEnd: 3000 },
      );
      result.geocoded       = true;
      result.geocoded_place = place.name;
      result.geocoded_lat   = place.lat;
      result.geocoded_lng   = place.lng;
      return result;
    }
  } catch (e) {
    console.error('geocoding failed:', e.message);
  }

  return { plans: [], destination };
}

// ════════════════════════════════════════════════
// planRoute — بحث بالاسم
// ════════════════════════════════════════════════

async function planRoute(destination, passengerLat, passengerLng) {
  const lat = parseFloat(passengerLat);
  const lng = parseFloat(passengerLng);

  const matchedStations = await prisma.stations.findMany({
    where:   { name: { contains: destination } },
    include: { route: true },
  });

  if (matchedStations.length === 0) return { plans: [], destination };

  let bestStation = matchedStations[0], bestDist = Infinity;
  for (const s of matchedStations) {
    if (s.lat != null && s.lng != null) {
      const d = getDistance(lat, lng, s.lat, s.lng);
      if (d < bestDist) { bestDist = d; bestStation = s; }
    }
  }

  if (bestStation.lat != null && bestStation.lng != null)
    return await _planRouteByCoords(destination, lat, lng, bestStation.lat, bestStation.lng);

  return { plans: [], destination, passenger: { lat, lng } };
}

// ════════════════════════════════════════════════════════════════
// _planRouteByCoords — الخوارزمية الرئيسية
//
// BUG FIX #1 — bestByTime + bestByWalking:
//   بدل خطة واحدة لكل زوج خطوط، نحفظ خيارين:
//   الأسرع (أقل وقت) والأريح (أقل مشي)
//
// BUG FIX #2 — إزالة قيد الاتجاه في نقاط التحويل:
//   الكود القديم كان يشيل s1 إذا كان order_index أقل من محطة الركوب.
//   هاد بيمنع إيجاد تحويلات صحيحة لما الراكب قريب من آخر محطة بالخط.
//   الحل: بدل القيد الصارم، نستخدم Math.abs() ونتأكد فقط إن s1 ≠ محطة الركوب
//   وإن st1 > 0، وكذلك للخط الثاني.
//
// BUG FIX #3 — مقارنة الخطط بـ _planId() بدل JSON.stringify(legs)
// ════════════════════════════════════════════════════════════════

async function _planRouteByCoords(destName, passengerLat, passengerLng, destLat, destLng, options = {}) {
  const MAX_WALK_TO_START  = 2000;
  const MAX_WALK_FROM_END  = options.maxWalkFromEnd || 1500;
  const TRANSFER_RADIUS    = 800;
  const WALK_SPEED         = 70;
  const MIN_PER_STATION    = 3;
  const MAX_TOTAL_MINUTES  = 90;

  const E_BUS           = 1;
  const E_WALK_START    = 3;
  const E_WALK_TRANSFER = 5;
  const E_WALK_END      = 2;
  const E_TRANSFER_FIX  = 3;

  const allRoutes = await prisma.routes.findMany({
    include: {
      stations: { orderBy: { order_index: 'asc' } },
      buses:    { where: { current_status: 'active' } },
    },
  });

  // ── المرحلة 1: تحليل كل خط ──
  const routeAnalysis = [];
  for (const route of allRoutes) {
    let nearestToPassenger = null, distToPassenger = Infinity;
    let nearestToDest      = null, distToDest      = Infinity;

    for (const s of route.stations) {
      if (s.lat == null || s.lng == null) continue;
      const dp = getDistance(passengerLat, passengerLng, s.lat, s.lng);
      if (dp < distToPassenger) { distToPassenger = dp; nearestToPassenger = s; }
      const dd = getDistance(destLat, destLng, s.lat, s.lng);
      if (dd < distToDest)      { distToDest = dd;      nearestToDest = s; }
    }

    routeAnalysis.push({ route, nearestToPassenger, distToPassenger, nearestToDest, distToDest });
  }

  // ── المرحلة 2: رحلات مباشرة ──
  //
  // FIX: بدل ما نجيب محطة ركوب واحدة × محطة نزول واحدة لكل خط،
  // الآن نجيب أفضل 3 ركوب × أفضل 3 نزول = حتى 9 تركيبات لكل خط.
  //
  // ليش هالتغيير يحل المشكلة؟
  // لو في خط واحد بس يخدم المنطقة، الكود القديم كان يجيب خطة واحدة فقط
  // → fastest = comfort → ما بيطلع غير خيار واحد.
  //
  // مثال: خط رقم 1، الراكب قريب من موقفين (S3=200م، S4=900م)،
  //        الوجهة قريبة من موقفين (S8=100م، S9=400م):
  //   تركيبة 1: S3→S8 = 200م مشي + 5 محطات + 100م = 17 دقيقة، 300م مشي
  //   تركيبة 2: S3→S9 = 200م مشي + 6 محطات + 400م = 26 دقيقة، 600م مشي ← أبطأ بس أريح لو S9 قريب
  //   تركيبة 3: S4→S8 = 900م مشي + 4 محطات + 100م = 24 دقيقة، 1000م مشي ← ما بتطلع (أطول)
  //   → الأسرع = S3→S8 (17 دق)، الأريح = S3→S9 (أقل مشي إجمالي بعد الحساب) أو نفس S3→S8
  //   على الأقل عندنا مرشحين مختلفين يطلع منهم خياران.
  // ─────────────────────────────────────────────────────────

  const directPlans = [];

  for (const ra of routeAnalysis) {
    const { route } = ra;

    // أفضل 3 محطات ركوب (قريبة من الراكب)
    const topBoarding = route.stations
      .filter(s => s.lat != null && s.lng != null)
      .map(s => ({ s, dist: getDistance(passengerLat, passengerLng, s.lat, s.lng) }))
      .filter(({ dist }) => dist <= MAX_WALK_TO_START)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);

    // أفضل 3 محطات نزول (قريبة من الوجهة)
    const topAlighting = route.stations
      .filter(s => s.lat != null && s.lng != null)
      .map(s => ({ s, dist: getDistance(destLat, destLng, s.lat, s.lng) }))
      .filter(({ dist }) => dist <= MAX_WALK_FROM_END)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);

    if (topBoarding.length === 0 || topAlighting.length === 0) continue;

    // جرب كل تركيبة ركوب × نزول
    for (const { s: boarding, dist: dBoard } of topBoarding) {
      for (const { s: alighting, dist: dAlight } of topAlighting) {
        if (boarding.station_id === alighting.station_id) continue;

        const stationCount = Math.abs(
          (alighting.order_index || 0) - (boarding.order_index || 0)
        );
        if (stationCount === 0) continue;

        const busMin       = Math.min(60, Math.max(1, stationCount * MIN_PER_STATION));
        const walkToStart  = Math.round(dBoard  / WALK_SPEED);
        const walkFromEnd  = Math.round(dAlight / WALK_SPEED);
        const totalMin     = busMin + walkToStart + walkFromEnd;
        if (totalMin > MAX_TOTAL_MINUTES) continue;

        const busEta       = _calcBusEta(route.buses, boarding.order_index, MIN_PER_STATION);
        const effortScore  = busMin * E_BUS + walkToStart * E_WALK_START + walkFromEnd * E_WALK_END;
        const totalWalking = Math.round(dBoard) + Math.round(dAlight);

        directPlans.push({
          type: 'direct', type_ar: 'رحلة مباشرة',
          total_minutes: totalMin, effort_score: effortScore, total_walking: totalWalking,
          walk_to_station: Math.round(dBoard),
          walk_from_end:   Math.round(dAlight), walk_from_end_minutes: walkFromEnd,
          from_station_lat: boarding.lat,  from_station_lng: boarding.lng,
          dest_station_lat: alighting.lat, dest_station_lng: alighting.lng,
          destination_lat: destLat, destination_lng: destLng,
          legs: [
            {
              action: 'bus', route_name: route.route_name,
              from: boarding.name, to: alighting.name,
              from_lat: boarding.lat,  from_lng: boarding.lng,
              to_lat:   alighting.lat, to_lng:   alighting.lng,
              stations: stationCount, minutes: busMin,
              buses: route.buses.length, bus_eta: busEta,
            },
            ...(dAlight > 100 ? [{
              action: 'walk', from: alighting.name, to: destName,
              from_lat: alighting.lat, from_lng: alighting.lng,
              to_lat: destLat, to_lng: destLng,
              meters: Math.round(dAlight), minutes: walkFromEnd,
            }] : []),
          ],
        });
      }
    }
  }

  // ── المرحلة 3: رحلات بتحويل ──
  //
  // BUG FIX #2 — إزالة قيد الاتجاه الصارم
  // ─────────────────────────────────────────────────────────
  // الكود القديم كان يرفض s1 إذا:
  //   s1.order_index <= origin.station.order_index
  // وهاد يعني: لو الراكب عند محطة بـ order_index عالي (قرب آخر الخط)،
  // كل المحطات قبلها بتنرفض → ما في تحويل!
  //
  // الإصلاح: بدل القيد نستخدم شرط بسيط:
  //   s1.station_id !== origin.station.station_id  (مو نفس محطة الركوب)
  //   st1 > 0                                       (لازم نسافر محطة على الأقل)
  // والاتجاه المنطقي ببيّن من حساب الوقت والمسافة — مو من مقارنة index.
  // ─────────────────────────────────────────────────────────

  const bestByTime    = {};   // key → أسرع خطة لكل زوج خطوط
  const bestByWalking = {};   // key → أريح خطة (أقل مشي) لكل زوج خطوط

  // فهرس مواقف قريبة من الراكب
  const passengerStops = [];
  for (const ra of routeAnalysis) {
    if (!ra.route.stations?.length) continue;
    const nearby = ra.route.stations
      .filter(s => s.lat != null && s.lng != null)
      .map(s => ({ station: s, distance: getDistance(passengerLat, passengerLng, s.lat, s.lng) }))
      .filter(s => s.distance <= MAX_WALK_TO_START)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
    for (const sd of nearby) passengerStops.push({ route: ra.route, ...sd });
  }

  // فهرس مواقف قريبة من الوجهة
  const destStops = [];
  for (const ra of routeAnalysis) {
    if (!ra.route.stations?.length) continue;
    const nearby = ra.route.stations
      .filter(s => s.lat != null && s.lng != null)
      .map(s => ({ station: s, distance: getDistance(destLat, destLng, s.lat, s.lng) }))
      .filter(s => s.distance <= MAX_WALK_FROM_END)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
    for (const sd of nearby) destStops.push({ route: ra.route, ...sd });
  }

  for (const origin of passengerStops) {
    for (const dest of destStops) {
      if (origin.route.route_id === dest.route.route_id) continue;

      const key = `${origin.route.route_id}-${dest.route.route_id}`;

      for (const s1 of origin.route.stations) {
        if (!s1.lat || !s1.lng) continue;
        // ✅ FIX: بدل قيد الاتجاه، فقط تأكد إنها مو نفس محطة الركوب
        if (s1.station_id === origin.station.station_id) continue;

        for (const s2 of dest.route.stations) {
          if (!s2.lat || !s2.lng) continue;
          // ✅ FIX: بدل قيد الاتجاه، فقط تأكد إنها مو نفس محطة الوجهة
          if (s2.station_id === dest.station.station_id) continue;

          const transferDist = getDistance(s1.lat, s1.lng, s2.lat, s2.lng);
          if (transferDist > TRANSFER_RADIUS) continue;

          const st1 = Math.abs((s1.order_index || 0) - (origin.station.order_index || 0));
          const st2 = Math.abs((dest.station.order_index || 0) - (s2.order_index || 0));
          if (st1 === 0 || st2 === 0) continue;

          const bus1Min         = Math.min(60, Math.max(1, st1 * MIN_PER_STATION));
          const bus2Min         = Math.min(60, Math.max(1, st2 * MIN_PER_STATION));
          const walkStartMin    = Math.round(origin.distance / WALK_SPEED);
          const walkTransferMin = Math.max(1, Math.round(transferDist / WALK_SPEED));
          const walkEndMin      = Math.round(dest.distance / WALK_SPEED);
          const totalMin        = bus1Min + walkTransferMin + bus2Min + walkStartMin + walkEndMin;
          if (totalMin > MAX_TOTAL_MINUTES) continue;

          const totalWalking = Math.round(origin.distance) + Math.round(transferDist) + Math.round(dest.distance);
          const effortScore  =
            (bus1Min + bus2Min) * E_BUS    +
            walkStartMin        * E_WALK_START +
            walkTransferMin     * E_WALK_TRANSFER +
            walkEndMin          * E_WALK_END      +
            E_TRANSFER_FIX;

          const bus1Eta = _calcBusEta(origin.route.buses, origin.station.order_index, MIN_PER_STATION);
          const bus2Eta = _calcBusEta(dest.route.buses,   s2.order_index,             MIN_PER_STATION);

          const planObj = {
            type: 'transfer', type_ar: 'رحلة بتحويل',
            total_minutes: totalMin, effort_score: effortScore, total_walking: totalWalking,
            walk_to_station: Math.round(origin.distance),
            walk_from_end:   Math.round(dest.distance), walk_from_end_minutes: walkEndMin,
            from_station_lat: origin.station.lat, from_station_lng: origin.station.lng,
            dest_station_lat: dest.station.lat,   dest_station_lng: dest.station.lng,
            destination_lat: destLat, destination_lng: destLng,
            legs: [
              {
                action: 'bus', route_name: origin.route.route_name,
                from: origin.station.name, to: s1.name,
                from_lat: origin.station.lat, from_lng: origin.station.lng,
                to_lat: s1.lat, to_lng: s1.lng,
                stations: st1, minutes: bus1Min,
                buses: origin.route.buses.length, bus_eta: bus1Eta,
              },
              {
                action: 'walk', from: s1.name, to: s2.name,
                from_lat: s1.lat, from_lng: s1.lng,
                to_lat: s2.lat,   to_lng: s2.lng,
                meters: Math.round(transferDist), minutes: walkTransferMin,
              },
              {
                action: 'bus', route_name: dest.route.route_name,
                from: s2.name, to: dest.station.name,
                from_lat: s2.lat,  from_lng: s2.lng,
                to_lat: dest.station.lat, to_lng: dest.station.lng,
                stations: st2, minutes: bus2Min,
                buses: dest.route.buses.length, bus_eta: bus2Eta,
              },
              ...(dest.distance > 100 ? [{
                action: 'walk', from: dest.station.name, to: destName,
                from_lat: dest.station.lat, from_lng: dest.station.lng,
                to_lat: destLat, to_lng: destLng,
                meters: Math.round(dest.distance), minutes: walkEndMin,
              }] : []),
            ],
          };

          // BUG FIX #1 — حفظ خيارين لكل زوج خطوط
          if (!bestByTime[key]    || totalMin    < bestByTime[key].total_minutes)    bestByTime[key]    = { ...planObj };
          if (!bestByWalking[key] || totalWalking < bestByWalking[key].total_walking) bestByWalking[key] = { ...planObj };
        }
      }
    }
  }

  // دمج التحويلات — بدون تكرار
  const transferPlans  = [];
  const seenIds        = new Set();

  for (const plan of [...Object.values(bestByTime), ...Object.values(bestByWalking)]) {
    const id = _planId(plan);
    if (!seenIds.has(id)) { seenIds.add(id); transferPlans.push(plan); }
  }

  // ── المرحلة 4: اختيار الاقتراحين النهائيين ──
  const allCandidates = [...directPlans, ...transferPlans];

  if (allCandidates.length === 0)
    return { plans: [], destination: destName, passenger: { lat: passengerLat, lng: passengerLng } };

  // ⚡ الأسرع: أقل وقت (تعادل → أقل مشي)
  const fastestRaw = [...allCandidates].sort((a, b) =>
    a.total_minutes !== b.total_minutes
      ? a.total_minutes - b.total_minutes
      : (a.total_walking || 0) - (b.total_walking || 0)
  )[0];

  // 😌 الأريح: أقل مشي (تعادل → أسرع)
  const comfortRaw = [...allCandidates].sort((a, b) =>
    (a.total_walking || 0) !== (b.total_walking || 0)
      ? (a.total_walking || 0) - (b.total_walking || 0)
      : a.total_minutes - b.total_minutes
  )[0];

  // نسخ مستقلة — مهم! بدون spread كانوا نفس الكائن وبيتلوطوا
  const fastest       = { ...fastestRaw, tag: 'fastest', tag_ar: '⚡ الأسرع' };
  const mostComfort   = { ...comfortRaw, tag: 'comfort',  tag_ar: '😌 الأريح'  };

  const allPlans = [fastest];

  // BUG FIX #3 — مقارنة بـ _planId() الدقيقة بدل JSON.stringify
  if (_planId(fastest) !== _planId(mostComfort)) {
    allPlans.push(mostComfort);
  }

  console.log(`\n── النتيجة: ${allPlans.length} اقتراح`);
  allPlans.forEach(p =>
    console.log(`   [${p.tag_ar}] ${p.type_ar}: ${p.total_minutes} دق, مشي ${p.total_walking}م`)
  );

  return {
    plans:       allPlans,
    destination: destName,
    passenger:   { lat: passengerLat, lng: passengerLng },
  };
}

// ════════════════════════════════════════════════
// مساعدات
// ════════════════════════════════════════════════

function _planId(plan) {
  return (plan.legs || []).map(l => `${l.action}|${l.from}|${l.to}`).join('→');
}

function _calcBusEta(buses, stationIndex, minPerStation) {
  if (!buses || buses.length === 0) return null;
  let closest = Infinity;
  for (const bus of buses) {
    const diff = Math.abs((bus.current_station_index || 0) - (stationIndex || 0));
    if (diff < closest) closest = diff;
  }
  return closest * minPerStation;
}

// ════════════════════════════════════════════════
// Exports
// ════════════════════════════════════════════════

module.exports = {
  getAllStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
  searchByDestination,
  smartSearch,
  planRoute,
  getStationSuggestions,
  hybridSuggestions,
  planRouteV2,
};