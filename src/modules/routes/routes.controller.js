const routesService = require('./routes.service');

const getAll = async (req, res, next) => {
  try { res.json(await routesService.getAllRoutes()); }
  catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try { res.json(await routesService.getRouteById(req.params.id)); }
  catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try { res.status(201).json(await routesService.createRoute(req.body)); }
  catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try { res.json(await routesService.updateRoute(req.params.id, req.body)); }
  catch (err) { next(err); }
};

const saveStations = async (req, res, next) => {
  try { res.json(await routesService.saveRouteStations(req.params.id, req.body)); }
  catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await routesService.deleteRoute(req.params.id);
    res.json({ message: 'Route deleted successfully' });
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, saveStations, remove };
