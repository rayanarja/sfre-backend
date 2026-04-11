const prisma = require('../../config/database');
const { getDistance } = require('../../utils/geo');

const getAllStations = async () => {
  return await prisma.stations.findMany({ include: { route: true } });
};

const getStationById = async (id) => {
  const station = await prisma.stations.findUnique({
    where: { station_id: parseInt(id) },
    include: { route: true }
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
    include: { route: true }
  });
};

const updateStation = async (id, data) => {
  const updateData = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.route_id !== undefined) updateData.route_id = parseInt(data.route_id);
  if (data.lat !== undefined) updateData.lat = data.lat ? parseFloat(data.lat) : null;
  if (data.lng !== undefined) updateData.lng = data.lng ? parseFloat(data.lng) : null;
  if (data.order_index !== undefined) updateData.order_index = data.order_index ? parseInt(data.order_index) : null;
  return await prisma.stations.update({
    where: { station_id: parseInt(id) },
    data: updateData,
    include: { route: true },
  });
};

const deleteStation = async (id) => {
  return await prisma.stations.delete({ where: { station_id: parseInt(id) } });
};

const searchByDestination = async (destination) => {
  return await prisma.stations.findMany({
    where: {
      name: {
        contains: destination,
      }
    },
    include: {
      route: {
        include: {
          buses: true,
          stations: true  
        }
      }
    }
  });
};

// بحث ذكي — يرجع الخطوط + الباصات القريبة + الوقت المتوقع
const smartSearch = async (destination, passenger_lat, passenger_lng) => {
  // ابحث عن المواقف يلي بتطابق الوجهة
  const matchedStations = await prisma.stations.findMany({
    where: { name: { contains: destination } },
    include: {
      route: {
        include: {
          stations: { orderBy: { order_index: 'asc' } },
          buses: {
            where: { current_status: 'active' },
          },
        },
      },
    },
  });

  // جمّع النتائج حسب الخط
  const routesMap = {};

  for (const station of matchedStations) {
    if (!station.route) continue;
    const routeId = station.route.route_id;
    if (routesMap[routeId]) continue;

    const route = station.route;
    const allStations = route.stations;
    const activeBuses = route.buses;

    // حدد أقرب موقف للراكب (إذا عندنا إحداثياتو)
    let closestStation = null;
    let minDist = Infinity;

    if (passenger_lat && passenger_lng) {
      for (const s of allStations) {
        if (s.lat && s.lng) {
          const dist = getDistance(parseFloat(passenger_lat), parseFloat(passenger_lng), s.lat, s.lng);
          if (dist < minDist) {
            minDist = dist;
            closestStation = s;
          }
        }
      }
    }

    // حدد اتجاه الراكب
    let passengerDirection = null;
    if (closestStation) {
      passengerDirection = station.order_index > closestStation.order_index ? 'outbound' : 'inbound';
    }

    // حلل الباصات النشطة
    const busesInfo = activeBuses.map(bus => {
      const stationsDiff = closestStation
        ? Math.abs((bus.current_station_index || 0) - closestStation.order_index)
        : null;

      // حساب المسافة والوقت
      let totalDistance = 0;
      if (closestStation && bus.current_station_index != null) {
        const fromIdx = Math.min(bus.current_station_index, closestStation.order_index);
        const toIdx = Math.max(bus.current_station_index, closestStation.order_index);
        for (let i = fromIdx; i < toIdx; i++) {
          const s1 = allStations.find(s => s.order_index === i);
          const s2 = allStations.find(s => s.order_index === i + 1);
          if (s1 && s2 && s1.lat && s1.lng && s2.lat && s2.lng) {
            totalDistance += getDistance(s1.lat, s1.lng, s2.lat, s2.lng);
          }
        }
      }

      const distanceKm = totalDistance / 1000;
      const estimatedMinutes = distanceKm > 0 ? Math.max(1, Math.round((distanceKm / 25) * 60)) : null;

      // هل الباص بالاتجاه الصح؟
      let isIdeal = false;
      if (passengerDirection && bus.direction && closestStation) {
        if (passengerDirection === 'outbound') {
          isIdeal = bus.direction === 'outbound' && (bus.current_station_index || 0) <= closestStation.order_index;
        } else {
          isIdeal = bus.direction === 'inbound' && (bus.current_station_index || 0) >= closestStation.order_index;
        }
      }

      return {
        bus_id: bus.bus_id,
        plate_number: bus.plate_number,
        direction: bus.direction,
        direction_ar: bus.direction === 'outbound' ? 'ذهاب' : 'إياب',
        stations_away: stationsDiff,
        distance_meters: Math.round(totalDistance),
        estimated_minutes: estimatedMinutes,
        is_ideal: isIdeal,
      };
    });

    // رتب — الأفضل أول
    busesInfo.sort((a, b) => {
      if (a.is_ideal && !b.is_ideal) return -1;
      if (!a.is_ideal && b.is_ideal) return 1;
      return (a.stations_away || 999) - (b.stations_away || 999);
    });

    routesMap[routeId] = {
      route_id: route.route_id,
      route_name: route.route_name,
      matched_station: station.name,
      matched_station_index: station.order_index,
      stations_count: allStations.length,
      closest_station: closestStation ? {
        name: closestStation.name,
        order_index: closestStation.order_index,
        distance_meters: Math.round(minDist),
      } : null,
      passenger_direction: passengerDirection,
      passenger_direction_ar: passengerDirection === 'outbound' ? 'ذهاب' : passengerDirection === 'inbound' ? 'إياب' : null,
      active_buses: busesInfo,
      active_buses_count: activeBuses.length,
      best_eta_minutes: busesInfo.length > 0 ? busesInfo[0].estimated_minutes : null,
    };
  }

  // رتب الخطوط — الأقرب باص أولاً
  const results = Object.values(routesMap);
  results.sort((a, b) => (a.best_eta_minutes || 999) - (b.best_eta_minutes || 999));

  return results;
};


module.exports = {
  getAllStations, getStationById, createStation, updateStation,
  deleteStation, searchByDestination, smartSearch, planRoute, getStationSuggestions,
  hybridSuggestions, planRouteV2,
};

const { geocodePlace, hybridSuggestions: geoHybrid } = require('../../utils/geocoding');

/**
 * اقتراحات مختلطة — محطات + أماكن من الخريطة
 */
async function hybridSuggestions(query) {
  // اقتراحات المحطات
  const stationNames = await getStationSuggestions(query);
  
  // ادمج مع أماكن من Nominatim
  try {
    const results = await geoHybrid(query, stationNames);
    return results;
  } catch (e) {
    // إذا Nominatim فشل — رجّع محطات بس
    return stationNames.map(name => ({ name, type: 'station' }));
  }
}

/**
 * Route Planner v2 — بحث بالمحطات أو المناطق
 * 
 * إذا destination = اسم محطة → planRoute العادي
 * إذا destination = إحداثيات (dest_lat, dest_lng) → يلاقي أقرب محطات للوجهة ويخطط
 */
async function planRouteV2(destination, passengerLat, passengerLng, destLat, destLng) {
  const lat = parseFloat(passengerLat);
  const lng = parseFloat(passengerLng);

  // ═══ الحالة 1: عندنا إحداثيات الوجهة (بحث بالمنطقة) ═══
  if (destLat && destLng) {
    const dLat = parseFloat(destLat);
    const dLng = parseFloat(destLng);
    
    return await _planRouteByCoords(destination, lat, lng, dLat, dLng);
  }

  // ═══ الحالة 2: بحث بالاسم (ممكن محطة أو مكان) ═══
  // جرب أولاً كمحطة
  const stationResult = await planRoute(destination, passengerLat, passengerLng);
  if (stationResult.plans && stationResult.plans.length > 0) {
    return stationResult;
  }

  // ما لقينا محطة — جرب geocoding
  try {
    const places = await geocodePlace(destination, lat, lng);
    if (places && places.length > 0) {
      const place = places[0];
      const result = await _planRouteByCoords(destination, lat, lng, place.lat, place.lng);
      result.geocoded = true;
      result.geocoded_place = place.name;
      result.geocoded_lat = place.lat;
      result.geocoded_lng = place.lng;
      return result;
    }
  } catch (e) {
    // geocoding فشل
  }

  return { plans: [], destination };
}

/**
 * خطط مسار بالإحداثيات — يلاقي أقرب محطات للوجهة ويحسب الطريق
 * 
 * ═══ v2: دعم التحويل بين خطين ═══
 * القواعد:
 * 1. إذا في رحلة مباشرة → اعرضها (أولوية)
 * 2. إذا ما في مباشرة → ابحث عن تحويل (باص → مشي قصير → باص)
 * 3. أفضل تحويل واحد فقط لكل زوج خطوط (ما بدنا مليون خيار)
 * 4. حد أقصى 3 نتائج — الأقل جهد أولاً
 */
async function _planRouteByCoords(destName, passengerLat, passengerLng, destLat, destLng) {
  const MAX_WALK_TO_START = 2000;
  const MAX_WALK_FROM_END = 1500;
  const TRANSFER_RADIUS = 800;
  const WALK_SPEED = 70;
  const MIN_PER_STATION = 3;
  const MAX_TOTAL_MINUTES = 90;

  // ═══ أوزان الجهد — موحّدة لكل الخطط ═══
  const E_BUS = 1;
  const E_WALK_START = 3;
  const E_WALK_TRANSFER = 5;
  const E_WALK_END = 2;
  const E_TRANSFER_FIX = 3;

  console.log(`\n════════ ROUTE PLANNER DEBUG ════════`);
  console.log(`الوجهة: ${destName}`);
  console.log(`موقع الراكب: ${passengerLat}, ${passengerLng}`);
  console.log(`إحداثيات الوجهة: ${destLat}, ${destLng}`);


  const allRoutes = await prisma.routes.findMany({
    include: {
      stations: { orderBy: { order_index: 'asc' } },
      buses: { where: { current_status: 'active' } },
    },
  });

  // ═══════════════════════════════════════════════
  // المرحلة 1: تحليل كل خط — أقرب موقف للراكب وللوجهة
  // ═══════════════════════════════════════════════
  const routeAnalysis = [];
  for (const route of allRoutes) {
    let nearestToPassenger = null, distToPassenger = Infinity;
    let nearestToDest = null, distToDest = Infinity;

    for (const s of route.stations) {
      if (s.lat == null || s.lng == null) continue;
      
      const dp = getDistance(passengerLat, passengerLng, s.lat, s.lng);
      if (dp < distToPassenger) { distToPassenger = dp; nearestToPassenger = s; }
      
      const dd = getDistance(destLat, destLng, s.lat, s.lng);
      if (dd < distToDest) { distToDest = dd; nearestToDest = s; }
    }

    routeAnalysis.push({
      route,
      nearestToPassenger,
      distToPassenger,
      nearestToDest,
      distToDest,
    });
  }

  // ═══════════════════════════════════════════════
  // المرحلة 2: رحلات مباشرة
  // ═══════════════════════════════════════════════
  const directPlans = [];

  for (const ra of routeAnalysis) {
    const { route, nearestToPassenger, distToPassenger, nearestToDest, distToDest } = ra;
    
    if (!nearestToPassenger || !nearestToDest) continue;
    if (distToPassenger > MAX_WALK_TO_START) continue;
    if (distToDest > MAX_WALK_FROM_END) continue;
    if (nearestToPassenger.station_id === nearestToDest.station_id) continue;

    const stationCount = Math.abs((nearestToDest.order_index || 0) - (nearestToPassenger.order_index || 0));
    if (stationCount === 0) continue;

    const busMin = Math.min(60, Math.max(1, stationCount * MIN_PER_STATION));
    const walkToStart = Math.round(distToPassenger / WALK_SPEED);
    const walkFromEnd = Math.round(distToDest / WALK_SPEED);
    const totalMin = busMin + walkToStart + walkFromEnd;

    if (totalMin > MAX_TOTAL_MINUTES) continue;

    // حساب ETA أقرب باص
    const busEta = _calcBusEta(route.buses, nearestToPassenger.order_index, MIN_PER_STATION);

    // نفس أوزان الجهد متل التحويل — بس بدون عقوبة التبديل
    const effortScore = busMin * E_BUS + walkToStart * E_WALK_START + walkFromEnd * E_WALK_END;

    directPlans.push({
      type: 'direct', type_ar: 'رحلة مباشرة',
      total_minutes: totalMin,
      effort_score: effortScore,
      walk_to_station: Math.round(distToPassenger),
      walk_from_end: Math.round(distToDest),
      walk_from_end_minutes: walkFromEnd,
      from_station_lat: nearestToPassenger.lat,
      from_station_lng: nearestToPassenger.lng,
      dest_station_lat: nearestToDest.lat,
      dest_station_lng: nearestToDest.lng,
      destination_lat: destLat,
      destination_lng: destLng,
      legs: [
        {
          action: 'bus', route_name: route.route_name,
          from: nearestToPassenger.name, to: nearestToDest.name,
          from_lat: nearestToPassenger.lat, from_lng: nearestToPassenger.lng,
          to_lat: nearestToDest.lat, to_lng: nearestToDest.lng,
          stations: stationCount, minutes: busMin,
          buses: route.buses.length, bus_eta: busEta,
        },
        ...(distToDest > 100 ? [{
          action: 'walk',
          from: nearestToDest.name, to: destName,
          from_lat: nearestToDest.lat, from_lng: nearestToDest.lng,
          to_lat: destLat, to_lng: destLng,
          meters: Math.round(distToDest),
          minutes: walkFromEnd,
        }] : []),
      ],
    });
  }

  // ═══════════════════════════════════════════════
  // المرحلة 3: رحلات بتحويل — خوارزمية احترافية
  // ═══════════════════════════════════════════════
  const transferPlans = [];
  const bestTransfers = {};

  // بناء فهرس: لكل خط، أقرب 5 مواقف للراكب
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

  // بناء فهرس: لكل خط، أقرب 5 مواقف للوجهة
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

  console.log(`\n── مواقف قريبة من الراكب (${passengerStops.length}):`);
  passengerStops.slice(0, 10).forEach(s => console.log(`   ${s.route.route_name} → "${s.station.name}" (${Math.round(s.distance)}م)`));
  console.log(`── مواقف قريبة من الوجهة (${destStops.length}):`);
  destStops.slice(0, 10).forEach(s => console.log(`   ${s.route.route_name} → "${s.station.name}" (${Math.round(s.distance)}م)`));
  console.log(`── رحلات مباشرة: ${directPlans.length}`);
  directPlans.forEach(p => console.log(`   ${p.legs[0]?.route_name}: مشي ${p.walk_to_station}م → ${p.legs[0]?.stations} محطة → مشي ${p.walk_from_end || 0}م = ${p.total_minutes} دقيقة`));

  // جرّب كل تركيبة (موقف ركوب × موقف نزول × نقطة تحويل)
  for (const origin of passengerStops) {
    for (const dest of destStops) {
      // ما بنحول من خط لنفسو — بس الخطوط المعاكسة مسموحة!
      // مثلاً: جنوبي → شمالي = تحويل منطقي لأنهم بيمرقوا بمناطق مختلفة
      if (origin.route.route_id === dest.route.route_id) continue;

      // مفتاح فريد لكل تركيبة (خط أول → خط ثاني)
      const key = `${origin.route.route_id}-${dest.route.route_id}`;

      for (const s1 of origin.route.stations) {
        if (!s1.lat || !s1.lng) continue;
        if ((s1.order_index || 0) <= (origin.station.order_index || 0)) continue;

        for (const s2 of dest.route.stations) {
          if (!s2.lat || !s2.lng) continue;
          if ((s2.order_index || 0) >= (dest.station.order_index || 0)) continue;

          const transferDist = getDistance(s1.lat, s1.lng, s2.lat, s2.lng);
          if (transferDist > TRANSFER_RADIUS) continue;

          const st1 = Math.abs((s1.order_index || 0) - (origin.station.order_index || 0));
          const st2 = Math.abs((dest.station.order_index || 0) - (s2.order_index || 0));
          if (st1 === 0 || st2 === 0) continue;

          const bus1Min = Math.min(60, Math.max(1, st1 * MIN_PER_STATION));
          const bus2Min = Math.min(60, Math.max(1, st2 * MIN_PER_STATION));
          const walkStartMin = Math.round(origin.distance / WALK_SPEED);
          const walkTransferMin = Math.max(1, Math.round(transferDist / WALK_SPEED));
          const walkEndMin = Math.round(dest.distance / WALK_SPEED);
          const totalMin = bus1Min + walkTransferMin + bus2Min + walkStartMin + walkEndMin;

          if (totalMin > MAX_TOTAL_MINUTES) continue;

          // الجهد — المشي بين الباصين × 5 عقوبة!
          const effortScore =
            (bus1Min + bus2Min) * E_BUS +
            walkStartMin * E_WALK_START +
            walkTransferMin * E_WALK_TRANSFER +
            walkEndMin * E_WALK_END +
            E_TRANSFER_FIX;

          const bus1Eta = _calcBusEta(origin.route.buses, origin.station.order_index, MIN_PER_STATION);
          const bus2Eta = _calcBusEta(dest.route.buses, s2.order_index, MIN_PER_STATION);

          if (!bestTransfers[key] || effortScore < bestTransfers[key].effort_score) {
            bestTransfers[key] = {
              type: 'transfer', type_ar: 'رحلة بتحويل',
              total_minutes: totalMin,
              effort_score: effortScore,
              walk_to_station: Math.round(origin.distance),
              walk_from_end: Math.round(dest.distance),
              walk_from_end_minutes: walkEndMin,
              from_station_lat: origin.station.lat, from_station_lng: origin.station.lng,
              dest_station_lat: dest.station.lat, dest_station_lng: dest.station.lng,
              destination_lat: destLat, destination_lng: destLng,
              legs: [
                { action: 'bus', route_name: origin.route.route_name,
                  from: origin.station.name, to: s1.name,
                  from_lat: origin.station.lat, from_lng: origin.station.lng,
                  to_lat: s1.lat, to_lng: s1.lng,
                  stations: st1, minutes: bus1Min,
                  buses: origin.route.buses.length, bus_eta: bus1Eta },
                { action: 'walk', from: s1.name, to: s2.name,
                  from_lat: s1.lat, from_lng: s1.lng,
                  to_lat: s2.lat, to_lng: s2.lng,
                  meters: Math.round(transferDist), minutes: walkTransferMin },
                { action: 'bus', route_name: dest.route.route_name,
                  from: s2.name, to: dest.station.name,
                  from_lat: s2.lat, from_lng: s2.lng,
                  to_lat: dest.station.lat, to_lng: dest.station.lng,
                  stations: st2, minutes: bus2Min,
                  buses: dest.route.buses.length, bus_eta: bus2Eta },
                ...(dest.distance > 100 ? [{ action: 'walk',
                  from: dest.station.name, to: destName,
                  from_lat: dest.station.lat, from_lng: dest.station.lng,
                  to_lat: destLat, to_lng: destLng,
                  meters: Math.round(dest.distance), minutes: walkEndMin }] : []),
              ],
            };
          }
        }
      }
    }
  }

  transferPlans.push(...Object.values(bestTransfers));

  console.log(`── رحلات بتحويل: ${transferPlans.length}`);
  transferPlans.forEach(p => {
    const legs = p.legs || [];
    const busLegs = legs.filter(l => l.action === 'bus');
    const walkLegs = legs.filter(l => l.action === 'walk');
    console.log(`   ${busLegs.map(l => l.route_name).join(' → ')}: مشي ${p.walk_to_station}م + تحويل ${walkLegs[0]?.meters || 0}م = ${p.total_minutes} دقيقة (جهد: ${Math.round(p.effort_score)})`);
  });
  console.log(`════════════════════════════════\n`);

  // ═══════════════════════════════════════════════
  // المرحلة 4: خيارين واضحين — متل الشركات الكبيرة
  //
  // 🔵 الأفضل كوقت = أقل وقت كلي (حتى لو مشي كتير)
  // 🟠 الأفضل كراحة = أقل مشي كلي (حتى لو الوقت أطول)
  // ═══════════════════════════════════════════════
  const allCandidates = [...directPlans, ...transferPlans];
  if (allCandidates.length === 0) {
    return { plans: [], destination: destName, passenger: { lat: passengerLat, lng: passengerLng } };
  }

  // حساب إجمالي المشي لكل خطة
  for (const plan of allCandidates) {
    const walkLegs = (plan.legs || []).filter(l => l.action === 'walk');
    plan.total_walking = (plan.walk_to_station || 0) + walkLegs.reduce((sum, l) => sum + (l.meters || 0), 0);
  }

  // ═══ الأفضل كوقت: أقل total_minutes ═══
  const fastest = [...allCandidates].sort((a, b) => {
    if (a.total_minutes !== b.total_minutes) return a.total_minutes - b.total_minutes;
    return a.total_walking - b.total_walking; // تعادل؟ الأقل مشي
  })[0];
  fastest.tag = 'fastest';
  fastest.tag_ar = 'الأفضل كوقت';

  // ═══ الأفضل كراحة: أقل total_walking ═══
  const mostComfortable = [...allCandidates].sort((a, b) => {
    if (a.total_walking !== b.total_walking) return a.total_walking - b.total_walking;
    return a.total_minutes - b.total_minutes; // تعادل؟ الأسرع
  })[0];
  mostComfortable.tag = mostComfortable.tag || 'comfort';
  mostComfortable.tag_ar = mostComfortable.tag_ar || 'الأفضل كراحة';

  // ═══ جمع النتائج — بدون تكرار ═══
  const allPlans = [fastest];
  
  // أضف الراحة بس إذا مختلفة فعلاً عن الأسرع
  const sameRoute = JSON.stringify(fastest.legs?.map(l => l.from + l.to)) === 
                    JSON.stringify(mostComfortable.legs?.map(l => l.from + l.to));
  if (!sameRoute) {
    allPlans.push(mostComfortable);
  }

  console.log(`── النتيجة النهائية: ${allPlans.length} خيار`);
  allPlans.forEach(p => console.log(`   [${p.tag_ar}] ${p.type_ar}: ${p.total_minutes} دقيقة, مشي ${p.total_walking}م`));

  return {
    plans: allPlans,
    destination: destName,
    passenger: { lat: passengerLat, lng: passengerLng },
  };
}

/**
 * حساب ETA أقرب باص نشط لمحطة معينة
 */
function _calcBusEta(buses, stationIndex, minPerStation) {
  if (!buses || buses.length === 0) return null;
  let closest = Infinity;
  for (const bus of buses) {
    const diff = Math.abs((bus.current_station_index || 0) - (stationIndex || 0));
    if (diff < closest) closest = diff;
  }
  return closest * minPerStation;
}

// اقتراحات أسماء المواقف
async function getStationSuggestions(query) {
  const stations = await prisma.stations.findMany({
    where: { name: { contains: query } },
    select: { name: true },
    distinct: ['name'],
    take: 8,
  });
  return stations.map(s => s.name);
}

/**
 * Route Planner v5 — الإصلاح النهائي
 * 
 * القواعد:
 * 1. إذا في رحلة مباشرة → اعرضها بس (بدون تحويل)
 * 2. التحويل يطلع فقط إذا ما في مباشرة
 * 3. أفضل تحويل واحد فقط لكل زوج خطوط
 * 4. حد أقصى 60 دقيقة لأي مرحلة
 */
async function planRoute(destination, passengerLat, passengerLng) {
  const lat = parseFloat(passengerLat);
  const lng = parseFloat(passengerLng);

  // ابحث عن المواقف يلي بتطابق الوجهة
  const matchedStations = await prisma.stations.findMany({
    where: { name: { contains: destination } },
    include: { route: true },
  });

  if (matchedStations.length === 0) return { plans: [], destination };

  // لاقي أفضل موقف وجهة (أقرب واحد للراكب — لأنو يلي بعيد مش منطقي)
  let bestStation = matchedStations[0];
  let bestDist = Infinity;
  for (const s of matchedStations) {
    if (s.lat != null && s.lng != null) {
      const d = getDistance(lat, lng, s.lat, s.lng);
      if (d < bestDist) { bestDist = d; bestStation = s; }
    }
  }

  // إذا الموقف عندو إحداثيات — استخدم الخوارزمية الموحّدة
  if (bestStation.lat != null && bestStation.lng != null) {
    return await _planRouteByCoords(destination, lat, lng, bestStation.lat, bestStation.lng);
  }

  // fallback — ما عندو إحداثيات (نادر)
  return { plans: [], destination, passenger: { lat, lng } };
}

function _nearest(route, lat, lng) {
  let n = null, m = Infinity;
  for (const s of route.stations) {
    if (s.lat == null || s.lng == null) continue;
    const d = getDistance(lat, lng, s.lat, s.lng);
    if (d < m) { m = d; n = s; }
  }
  return n;
}