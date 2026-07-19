const test = require('node:test');
const assert = require('node:assert/strict');

test('persists the second position for the same bus and map returns it', async () => {
  const databasePath = require.resolve('../src/config/database');
  const socketPath = require.resolve('../src/socket');
  const loggerPath = require.resolve('../src/utils/logger');
  const servicePath = require.resolve('../src/modules/bus-tracker/bus-tracker.service');

  const storedBus = {
    bus_id: 7,
    plate_number: 'TEST-7',
    route_id: 3,
    current_status: 'active',
    current_lat: null,
    current_lng: null,
    last_update: null,
    current_station_index: 1,
    direction: 'outbound',
    route: { route_id: 3, route_name: 'Test route', route_stations: [] },
  };
  const updatedIds = [];

  require.cache[databasePath] = {
    id: databasePath,
    filename: databasePath,
    loaded: true,
    exports: {
      buses: {
        findUnique: async ({ where }) => where.bus_id === storedBus.bus_id ? storedBus : null,
        update: async ({ where, data }) => {
          updatedIds.push(where.bus_id);
          Object.assign(storedBus, data);
          return {
            bus_id: storedBus.bus_id,
            current_lat: storedBus.current_lat,
            current_lng: storedBus.current_lng,
            last_update: storedBus.last_update,
          };
        },
        findMany: async () => [storedBus],
      },
      route_Stations: { count: async () => 0, findMany: async () => [] },
      bus_Tracking_Log: {
        create: async ({ data }) => ({ log_id: 1, ...data, timestamp: new Date() }),
      },
    },
  };
  require.cache[socketPath] = {
    id: socketPath,
    filename: socketPath,
    loaded: true,
    exports: { emitBusPosition: () => {} },
  };
  require.cache[loggerPath] = {
    id: loggerPath,
    filename: loggerPath,
    loaded: true,
    exports: { info: () => {}, error: () => {} },
  };
  delete require.cache[servicePath];
  const service = require(servicePath);

  const first = await service.updateBusPosition(7, '36.201', '37.101');
  await new Promise(resolve => setTimeout(resolve, 2));
  const second = await service.updateBusPosition(7, '36.202', '37.102');
  const map = await service.getMapBuses();

  assert.deepEqual(updatedIds, [7, 7]);
  assert.equal(typeof second.lat, 'number');
  assert.equal(storedBus.current_lat, 36.202);
  assert.equal(storedBus.current_lng, 37.102);
  assert.ok(second.last_update > first.last_update);
  assert.equal(map.buses[0].bus_id, 7);
  assert.equal(map.buses[0].lat, 36.202);
  assert.equal(map.buses[0].lng, 37.102);
  assert.equal(map.buses[0].last_update, second.last_update);

  const trackingServicePath = require.resolve('../src/modules/tracking/tracking.service');
  delete require.cache[trackingServicePath];
  const trackingService = require(trackingServicePath);
  await trackingService.createLog({ bus_id: 7, lat: '36.203', lng: '37.103' });
  const mapAfterLegacyTracking = await service.getMapBuses();

  assert.deepEqual(updatedIds, [7, 7, 7]);
  assert.equal(mapAfterLegacyTracking.buses[0].lat, 36.203);
  assert.equal(mapAfterLegacyTracking.buses[0].lng, 37.103);
});
