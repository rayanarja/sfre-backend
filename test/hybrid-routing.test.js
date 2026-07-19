const test = require('node:test');
const assert = require('node:assert/strict');
const { buildHybridSuggestions } = require('../src/modules/stations/hybrid-routing.service');

const stop = (station_id, name, lat, lng) => ({ station_id, name, lat, lng });
const route = (route_id, route_name, stations, direction = 'outbound') => ({
  route_id,
  route_name,
  buses: [],
  route_stations: stations.map((station, index) => ({
    direction,
    station_order: index + 1,
    station,
  })),
});

test('returns every direct line once instead of only the fastest line', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.02, lng: 37.02 };
  const network = [
    route(1, 'Line A', [stop(1, 'A1', 36, 37), stop(2, 'A2', 36.02, 37.02)]),
    route(2, 'Line B', [stop(3, 'B1', 36.0002, 37), stop(4, 'B2', 36.0202, 37.02)]),
  ];

  const result = buildHybridSuggestions(network, origin, destination);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(item => item.legs.find(leg => leg.mode === 'bus').route_id).sort(), [1, 2]);
  assert.ok(result.every(item => item.transit_type === 'direct'));
});

test('returns a two-line transfer through nearby stops when no direct line exists', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.04, lng: 37.04 };
  const network = [
    route(1, 'Line A', [stop(1, 'Start', 36, 37), stop(2, 'Transfer A', 36.02, 37.02)]),
    route(2, 'Line B', [stop(3, 'Transfer B', 36.0203, 37.0203), stop(4, 'End', 36.04, 37.04)]),
  ];

  const result = buildHybridSuggestions(network, origin, destination);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, 'transfer');
  assert.equal(result[0].legs.filter(leg => leg.mode === 'bus').length, 2);
  assert.equal(result[0].transfer_stop.from_stop.name, 'Transfer A');
  assert.ok(result[0].transfer_stop.walking_distance_meters > 0);
});

test('rejects a journey whose first or last walk exceeds the transit walking limits', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.03, lng: 37.03 };
  const network = [
    route(1, 'Line A', [stop(1, 'Start', 36, 37), stop(2, 'Nearest End', 36.02, 37.02)]),
  ];

  const result = buildHybridSuggestions(network, origin, destination);
  assert.deepEqual(result, []);
});

test('does not invent a transfer when an acceptable direct route exists', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.02, lng: 37.02 };
  const network = [
    route(1, 'Slow direct', [
      stop(1, 'Direct start', 36.002, 37),
      stop(2, 'Direct end', 36.02, 37.02),
    ]),
    route(2, 'First bus', [
      stop(3, 'Near user', 36, 37),
      stop(4, 'Transfer A', 36.01, 37.01),
    ]),
    route(3, 'Second bus', [
      stop(5, 'Transfer B', 36.0102, 37.0102),
      stop(6, 'Near destination', 36.02, 37.02),
    ]),
  ];

  const result = buildHybridSuggestions(network, origin, destination);
  assert.ok(result.some(item => item.transit_type === 'direct'));
  assert.ok(result.every(item => item.transit_type === 'direct'));
});

test('does not walk to or past the destination to board a bus back toward it', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.004, lng: 37 };
  const network = [
    route(1, 'Backward bus', [
      stop(1, 'Economics after destination', 36.005, 37),
      stop(2, 'University destination', 36.004, 37),
    ]),
  ];

  const result = buildHybridSuggestions(network, origin, destination);
  assert.deepEqual(result, []);
});

test('allows a valid transfer whose bus route is not geometrically straight toward the destination', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.02, lng: 37.02 };
  const network = [
    route(1, 'First bus around the road', [
      stop(1, 'Near user', 36, 37),
      stop(2, 'Transfer A', 35.999, 37.01),
    ]),
    route(2, 'Second bus', [
      stop(3, 'Transfer B', 35.9991, 37.0101),
      stop(4, 'Destination', 36.02, 37.02),
    ]),
  ];

  const result = buildHybridSuggestions(network, origin, destination);
  assert.equal(result.length, 1);
  assert.equal(result[0].transit_type, 'transfer');
});

test('never returns a walking leg longer than 250 metres', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.02, lng: 37.02 };
  const network = [
    route(1, 'Valid direct', [
      stop(1, 'Near user', 36.002, 37),
      stop(2, 'Near destination', 36.02, 37.022),
    ]),
  ];

  const result = buildHybridSuggestions(network, origin, destination);
  assert.ok(result.length > 0);
  const walks = result.flatMap(item => item.legs.filter(leg => leg.mode === 'walking'));
  assert.ok(walks.every(leg => leg.distance_meters <= 250));
});

test('returns fastest and least-walking direct choices when their stops differ', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.01, lng: 37 };
  const network = [
    route(1, 'Destination line', [
      stop(1, 'Start', 36, 37),
      stop(2, 'Stop before destination', 36.0085, 37),
      stop(3, 'Stop at destination', 36.01, 37),
    ]),
  ];

  const result = buildHybridSuggestions(network, origin, destination);
  assert.equal(result.length, 2);
  assert.deepEqual(
    new Set(result.map(item => item.recommendation_type)),
    new Set(['fastest', 'least_walking']),
  );
  const leastWalking = result.find(item => item.recommendation_type === 'least_walking');
  const leastWalkingBus = leastWalking.legs.find(leg => leg.mode === 'bus');
  assert.equal(leastWalkingBus.to_stop.name, 'Stop at destination');
  assert.equal(leastWalking.walking_distance_meters, 0);
});

test('returns one direct choice when fastest is also least walking', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.01, lng: 37 };
  const network = [
    route(1, 'Single choice', [
      stop(1, 'Start', 36, 37),
      stop(2, 'Destination', 36.01, 37),
    ]),
  ];

  const result = buildHybridSuggestions(network, origin, destination);
  assert.equal(result.length, 1);
  assert.equal(result[0].recommendation_type, 'fastest_and_least_walking');
});

test('rejects invalid coordinates instead of querying with corrupted graph weights', () => {
  assert.throws(
    () => buildHybridSuggestions([], { lat: 100, lng: 37 }, { lat: 36, lng: 37 }),
    error => error.status === 400,
  );
});
