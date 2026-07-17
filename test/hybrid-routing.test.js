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

test('uses the nearest reachable stop and reports last-mile walking', () => {
  const origin = { lat: 36, lng: 37 };
  const destination = { lat: 36.03, lng: 37.03 };
  const network = [
    route(1, 'Line A', [stop(1, 'Start', 36, 37), stop(2, 'Nearest End', 36.02, 37.02)]),
  ];

  const [result] = buildHybridSuggestions(network, origin, destination);
  const finalLeg = result.legs[result.legs.length - 1];
  assert.equal(result.type, 'walking_required');
  assert.equal(result.transit_type, 'direct');
  assert.equal(finalLeg.purpose, 'last_mile');
  assert.ok(finalLeg.distance_meters > 1000);
  assert.equal(result.walking_distance_meters, finalLeg.distance_meters);
});

test('rejects invalid coordinates instead of querying with corrupted graph weights', () => {
  assert.throws(
    () => buildHybridSuggestions([], { lat: 100, lng: 37 }, { lat: 36, lng: 37 }),
    error => error.status === 400,
  );
});
