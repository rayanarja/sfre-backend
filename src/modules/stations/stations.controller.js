const stationsService = require('./stations.service');

const getAll = async (req, res, next) => {
  try {
    const stations = await stationsService.getAllStations();
    res.json(stations);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const station = await stationsService.getStationById(req.params.id);
    res.json(station);
  } catch (err) { next(err); }
};
const create = async (req, res, next) => {
  try {
    const station = await stationsService.createStation(req.body);
    res.status(201).json(station);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const station = await stationsService.updateStation(req.params.id, req.body);
    res.json(station);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await stationsService.deleteStation(req.params.id);
    res.json({ message: 'تم حذف المحطة بنجاح' });
  } catch (err) { next(err); }
};

const searchDestination = async (req, res, next) => {
  try {
    const { destination } = req.query;
    if (!destination) return res.status(400).json({ message: 'أدخل اسم الوجهة' });
    const results = await stationsService.searchByDestination(destination);
    res.json(results);
  } catch (err) { next(err); }
};

const smartSearch = async (req, res, next) => {
  try {
    const { destination, lat, lng } = req.query;
    if (!destination) return res.status(400).json({ message: 'أدخل اسم الوجهة' });
    const results = await stationsService.smartSearch(destination, lat, lng);
    res.json(results);
  } catch (err) { next(err); }
};

const planRoute = async (req, res, next) => {
  try {
    const { destination, lat, lng } = req.query;
    if (!destination) return res.status(400).json({ message: 'أدخل اسم الوجهة' });
    if (!lat || !lng) return res.status(400).json({ message: 'أرسل موقعك (lat, lng)' });
    const results = await stationsService.planRoute(destination, lat, lng);
    res.json(results);
  } catch (err) { next(err); }
};

const suggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const results = await stationsService.getStationSuggestions(q);
    res.json(results);
  } catch (err) { next(err); }
};

const hybridSuggestions = async (req, res, next) => {
  try {
    const input = (req.method === 'POST' ? req.body : req.query) || {};
    const userLocation = input.user_location || {
      lat: input.user_lat ?? input.lat,
      lng: input.user_lng ?? input.lng,
    };
    const destinationCoords = input.destination_coords || {
      lat: input.dest_lat,
      lng: input.dest_lng,
    };
    const hasCoordinates = [
      userLocation.lat ?? userLocation.latitude,
      userLocation.lng ?? userLocation.longitude,
      destinationCoords.lat ?? destinationCoords.latitude,
      destinationCoords.lng ?? destinationCoords.longitude,
    ].some(value => value !== undefined && value !== null && value !== '');

    // Backward compatibility: the original endpoint is also used by destination autocomplete.
    if (!hasCoordinates) {
      if (!input.q) return res.json([]);
      return res.json(await stationsService.getPlaceSuggestions(input.q));
    }

    const results = await stationsService.getHybridSuggestions(userLocation, destinationCoords);
    res.json(results);
  } catch (err) { next(err); }
};

const planRouteV2 = async (req, res, next) => {
  try {
    const { destination, lat, lng, dest_lat, dest_lng } = req.query;
    if (!destination) return res.status(400).json({ message: 'أدخل اسم الوجهة' });
    if (!lat || !lng) return res.status(400).json({ message: 'أرسل موقعك (lat, lng)' });
    const results = await stationsService.planRouteV2(destination, lat, lng, dest_lat, dest_lng);
    res.json(results);
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, searchDestination, smartSearch, planRoute, suggestions, hybridSuggestions, planRouteV2 };
