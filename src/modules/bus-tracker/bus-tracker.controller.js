const trackerService = require('./bus-tracker.service');

const updatePosition = async (req, res, next) => {
  try {
    const result = await trackerService.updateBusPosition(req.params.bus_id, req.body.lat, req.body.lng);
    res.json(result);
  } catch (err) { next(err); }
};

const findBuses = async (req, res, next) => {
  try {
    const { route_id, passenger_station_index, destination_station_index } = req.query;
    const result = await trackerService.findBusesForPassenger(route_id, passenger_station_index, destination_station_index);
    res.json(result);
  } catch (err) { next(err); }
};

const getMapBuses = async (req, res, next) => {
  try {
    const result = await trackerService.getMapBuses(req.query);
    res.json(result);
  } catch (err) { next(err); }
};

const getStations = async (req, res, next) => {
  try {
    const result = await trackerService.getRouteStations(req.params.route_id);
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = { updatePosition, findBuses, getMapBuses, getStations };
