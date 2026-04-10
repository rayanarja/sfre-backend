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
  try { res.json(await routesService.createRoute(req.body)); }
  catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try { res.json(await routesService.updateRoute(req.params.id, req.body)); }
  catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try { res.json(await routesService.deleteRoute(req.params.id)); }
  catch (err) { next(err); }
};

const linkRoutes = async (req, res, next) => {
  try { res.json(await routesService.linkRoutes(req.body.route1_id, req.body.route2_id)); }
  catch (err) { next(err); }
};

const unlinkRoutes = async (req, res, next) => {
  try { res.json(await routesService.unlinkRoutes(req.params.id)); }
  catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, linkRoutes, unlinkRoutes };
