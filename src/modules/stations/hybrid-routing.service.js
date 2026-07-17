const { getDistance } = require('../../utils/geo');

const DIRECTIONS = ['outbound', 'inbound'];

const DEFAULT_OPTIONS = Object.freeze({
  walkSpeedMetersPerMinute: 70,
  minutesPerStop: 3,
  waitMinutesPerBoarding: 5,
  minimumBoardingRadiusMeters: 2000,
  minimumDestinationRadiusMeters: 500,
  nearestStopToleranceMeters: 250,
  maxTransferWalkMeters: 250,
});

const asCoordinates = (value = {}) => ({
  lat: Number(value.lat ?? value.latitude),
  lng: Number(value.lng ?? value.longitude),
});

const hasCoordinates = (station) =>
  station?.lat !== null
  && station?.lat !== undefined
  && station?.lng !== null
  && station?.lng !== undefined
  && Number.isFinite(Number(station.lat))
  && Number.isFinite(Number(station.lng));

const stopSummary = (station) => ({
  station_id: station.station_id,
  name: station.name,
  lat: Number(station.lat),
  lng: Number(station.lng),
});

const walkingMinutes = (meters, options) =>
  Math.max(0, Math.ceil(meters / options.walkSpeedMetersPerMinute));

const buildPatterns = (routes) => {
  const patterns = [];

  for (const route of routes) {
    for (const direction of DIRECTIONS) {
      const stops = (route.route_stations || [])
        .filter(item => item.direction === direction && hasCoordinates(item.station))
        .sort((a, b) => a.station_order - b.station_order)
        .map(item => ({
          ...stopSummary(item.station),
          station_order: item.station_order,
        }));

      if (stops.length < 2) continue;
      patterns.push({
        key: `${route.route_id}:${direction}`,
        route_id: route.route_id,
        route_name: route.route_name,
        direction,
        active_buses: (route.buses || []).filter(bus => bus.direction === direction).length,
        stops,
      });
    }
  }

  return patterns;
};

const uniqueStops = (patterns) => {
  const stops = new Map();
  for (const pattern of patterns) {
    for (const stop of pattern.stops) stops.set(stop.station_id, stop);
  }
  return [...stops.values()];
};

const distanceTo = (point, stop) => getDistance(point.lat, point.lng, stop.lat, stop.lng);

const calculateAccessLimits = (patterns, origin, destination, options) => {
  const stops = uniqueStops(patterns);
  if (stops.length === 0) return null;

  let nearestOrigin = Infinity;
  let nearestDestination = Infinity;
  for (const stop of stops) {
    nearestOrigin = Math.min(nearestOrigin, distanceTo(origin, stop));
    nearestDestination = Math.min(nearestDestination, distanceTo(destination, stop));
  }

  return {
    // Always make the nearest stop reachable, even in sparse parts of the network.
    origin: Math.max(
      options.minimumBoardingRadiusMeters,
      nearestOrigin + options.nearestStopToleranceMeters,
    ),
    // If no stop is beside the destination, restrict routing to the globally nearest
    // destination stops instead of treating every remote stop as a valid destination.
    destination: Math.max(
      options.minimumDestinationRadiusMeters,
      nearestDestination + options.nearestStopToleranceMeters,
    ),
  };
};

const routeLeg = (pattern, from, to, options) => {
  const stopCount = to.index - from.index;
  return {
    mode: 'bus',
    route_id: pattern.route_id,
    route_name: pattern.route_name,
    direction: pattern.direction,
    from_stop: stopSummary(from.stop),
    to_stop: stopSummary(to.stop),
    stop_count: stopCount,
    duration_minutes: stopCount * options.minutesPerStop,
    active_buses: pattern.active_buses,
  };
};

const walkingLeg = (from, to, distance, options, purpose) => ({
  mode: 'walking',
  purpose,
  from,
  to,
  distance_meters: Math.round(distance),
  duration_minutes: walkingMinutes(distance, options),
});

const finalizeSuggestion = ({ baseType, legs, transferStop = null }, options) => {
  const walkingLegs = legs.filter(leg => leg.mode === 'walking');
  const lastLeg = legs[legs.length - 1];
  const finalWalk = lastLeg?.mode === 'walking' ? lastLeg.distance_meters : 0;
  const walkingDistance = walkingLegs.reduce((sum, leg) => sum + leg.distance_meters, 0);
  const duration = legs.reduce((sum, leg) => sum + leg.duration_minutes, 0);
  const requiresLastMileWalk = finalWalk > options.minimumDestinationRadiusMeters;

  return {
    type: requiresLastMileWalk ? 'walking_required' : baseType,
    transit_type: baseType,
    total_duration: duration,
    total_duration_minutes: duration,
    walking_distance_meters: walkingDistance,
    walking_time_minutes: walkingLegs.reduce((sum, leg) => sum + leg.duration_minutes, 0),
    ...(transferStop && { transfer_stop: transferStop }),
    legs,
  };
};

const directCandidate = (pattern, origin, destination, limits, options) => {
  let best = null;

  for (let boardIndex = 0; boardIndex < pattern.stops.length - 1; boardIndex += 1) {
    const boardStop = pattern.stops[boardIndex];
    const accessDistance = distanceTo(origin, boardStop);
    if (accessDistance > limits.origin) continue;

    for (let alightIndex = boardIndex + 1; alightIndex < pattern.stops.length; alightIndex += 1) {
      const alightStop = pattern.stops[alightIndex];
      const finalDistance = distanceTo(destination, alightStop);
      if (finalDistance > limits.destination) continue;

      const board = { stop: boardStop, index: boardIndex };
      const alight = { stop: alightStop, index: alightIndex };
      const legs = [
        walkingLeg('user_location', stopSummary(boardStop), accessDistance, options, 'access'),
        { mode: 'waiting', duration_minutes: options.waitMinutesPerBoarding },
        routeLeg(pattern, board, alight, options),
        walkingLeg(stopSummary(alightStop), 'destination', finalDistance, options, 'last_mile'),
      ];
      const suggestion = finalizeSuggestion({ baseType: 'direct', legs }, options);

      if (!best || suggestion.total_duration < best.total_duration) best = suggestion;
    }
  }

  return best;
};

const transferCandidate = (first, second, origin, destination, limits, options) => {
  if (first.route_id === second.route_id) return null;
  let best = null;

  // Dynamic-programming tables remove the board/alight loops from the transfer-pair
  // scan. Each entry stores the cheapest way to reach or leave that transfer index.
  const bestBoardAt = first.stops.map((_, transferIndex) => {
    let choice = null;
    for (let boardIndex = 0; boardIndex < transferIndex; boardIndex += 1) {
      const stop = first.stops[boardIndex];
      const distance = distanceTo(origin, stop);
      if (distance > limits.origin) continue;
      const cost = walkingMinutes(distance, options)
        + options.waitMinutesPerBoarding
        + ((transferIndex - boardIndex) * options.minutesPerStop);
      if (!choice || cost < choice.cost) choice = { index: boardIndex, stop, distance, cost };
    }
    return choice;
  });

  const bestAlightAt = second.stops.map((_, transferIndex) => {
    let choice = null;
    for (let alightIndex = transferIndex + 1; alightIndex < second.stops.length; alightIndex += 1) {
      const stop = second.stops[alightIndex];
      const distance = distanceTo(destination, stop);
      if (distance > limits.destination) continue;
      const cost = ((alightIndex - transferIndex) * options.minutesPerStop)
        + walkingMinutes(distance, options);
      if (!choice || cost < choice.cost) choice = { index: alightIndex, stop, distance, cost };
    }
    return choice;
  });

  for (let firstTransferIndex = 1; firstTransferIndex < first.stops.length; firstTransferIndex += 1) {
    const firstBoard = bestBoardAt[firstTransferIndex];
    if (!firstBoard) continue;
    const firstTransferStop = first.stops[firstTransferIndex];

    for (let secondTransferIndex = 0; secondTransferIndex < second.stops.length - 1; secondTransferIndex += 1) {
      const secondAlight = bestAlightAt[secondTransferIndex];
      if (!secondAlight) continue;
      const secondTransferStop = second.stops[secondTransferIndex];
      const transferDistance = getDistance(
        firstTransferStop.lat,
        firstTransferStop.lng,
        secondTransferStop.lat,
        secondTransferStop.lng,
      );
      if (transferDistance > options.maxTransferWalkMeters) continue;

      const firstAlight = { stop: firstTransferStop, index: firstTransferIndex };
      const secondBoard = { stop: secondTransferStop, index: secondTransferIndex };
      const transferStop = {
        from_stop: stopSummary(firstTransferStop),
        to_stop: stopSummary(secondTransferStop),
        walking_distance_meters: Math.round(transferDistance),
      };
      const legs = [
        walkingLeg('user_location', stopSummary(firstBoard.stop), firstBoard.distance, options, 'access'),
        { mode: 'waiting', duration_minutes: options.waitMinutesPerBoarding },
        routeLeg(first, firstBoard, firstAlight, options),
        walkingLeg(
          stopSummary(firstTransferStop),
          stopSummary(secondTransferStop),
          transferDistance,
          options,
          'transfer',
        ),
        { mode: 'waiting', duration_minutes: options.waitMinutesPerBoarding },
        routeLeg(second, secondBoard, secondAlight, options),
        walkingLeg(stopSummary(secondAlight.stop), 'destination', secondAlight.distance, options, 'last_mile'),
      ];
      const suggestion = finalizeSuggestion({ baseType: 'transfer', legs, transferStop }, options);

      if (!best || suggestion.total_duration < best.total_duration) best = suggestion;
    }
  }

  return best;
};

/**
 * Finds all valid direct route patterns. Only when none exists, it evaluates
 * every ordered pair of route patterns for a single geographically valid transfer.
 * Complexity is O(P^2 * S^2), with P route-direction patterns and S stops per pattern.
 */
const buildHybridSuggestions = (networkData, userLocation, destinationCoords, customOptions = {}) => {
  const options = { ...DEFAULT_OPTIONS, ...customOptions };
  const origin = asCoordinates(userLocation);
  const destination = asCoordinates(destinationCoords);
  if (![origin.lat, origin.lng, destination.lat, destination.lng].every(Number.isFinite)
    || Math.abs(origin.lat) > 90
    || Math.abs(destination.lat) > 90
    || Math.abs(origin.lng) > 180
    || Math.abs(destination.lng) > 180) {
    throw { status: 400, message: 'Valid user and destination coordinates are required' };
  }

  const patterns = buildPatterns(networkData || []);
  const limits = calculateAccessLimits(patterns, origin, destination, options);
  if (!limits) return [];

  // One best journey per line and direction prevents duplicate stop combinations,
  // while retaining every distinct line that can make the direct journey.
  const direct = patterns
    .map(pattern => directCandidate(pattern, origin, destination, limits, options))
    .filter(Boolean)
    .sort((a, b) => a.total_duration - b.total_duration);
  if (direct.length > 0) return direct;

  // No direct line exists: retain the best transfer point for every ordered line pair.
  const transfers = [];
  for (const first of patterns) {
    for (const second of patterns) {
      const candidate = transferCandidate(first, second, origin, destination, limits, options);
      if (candidate) transfers.push(candidate);
    }
  }

  return transfers.sort((a, b) => a.total_duration - b.total_duration);
};

module.exports = { buildHybridSuggestions, DEFAULT_OPTIONS };
