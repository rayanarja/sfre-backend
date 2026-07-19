const posService = require('./pos.service');

const getAll = async (req, res, next) => { try { res.json(await posService.getAllPOS()); } catch (e) { next(e); } };
const getOne = async (req, res, next) => { try { res.json(await posService.getPOSById(req.params.id)); } catch (e) { next(e); } };
const create = async (req, res, next) => { try { res.status(201).json(await posService.createPOS(req.body)); } catch (e) { next(e); } };
const update = async (req, res, next) => { try { res.json(await posService.updatePOS(req.params.id, req.body)); } catch (e) { next(e); } };
const remove = async (req, res, next) => { try { res.json(await posService.deletePOS(req.params.id)); } catch (e) { next(e); } };
const recharge = async (req, res, next) => { try { res.json(await posService.rechargeBalance(req.params.id, req.body.amount)); } catch (e) { next(e); } };
const login = async (req, res, next) => { try { res.json(await posService.loginPOS(req.body.phone, req.body.password)); } catch (e) { next(e); } };
const dashboard = async (req, res, next) => { try { res.json(await posService.getDashboard(req.user.id)); } catch (e) { next(e); } };
const sell = async (req, res, next) => { try { res.json(await posService.sellSubscription(req.user.id, req.body.user_email, req.body.plan_id)); } catch (e) { next(e); } };
const transactions = async (req, res, next) => { try { res.json(await posService.getTransactions(req.params.id)); } catch (e) { next(e); } };
const active = async (req, res, next) => { try { res.json(await posService.getActivePOS()); } catch (e) { next(e); } };
const changePass = async (req, res, next) => { try { res.json(await posService.changePassword(req.body.pos_id, req.body.old_password, req.body.new_password)); } catch (e) { next(e); } };
module.exports = { getAll, getOne, create, update, remove, recharge, login, dashboard, sell, transactions, active, changePass };
