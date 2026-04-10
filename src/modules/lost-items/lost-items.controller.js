const lostItemsService = require('./lost-items.service');

const getAll = async (req, res, next) => {
  try { res.json(await lostItemsService.getAllLostItems()); }
  catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try { res.json(await lostItemsService.getLostItemById(req.params.id)); }
  catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try { res.status(201).json(await lostItemsService.createLostItem(req.body, req.file)); }
  catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try { res.json(await lostItemsService.updateLostItem(req.params.id, req.body)); }
  catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await lostItemsService.deleteLostItem(req.params.id);
    res.json({ message: 'تم حذف الغرض بنجاح' });
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    res.json(await lostItemsService.updateLostItemStatus(req.params.id, req.body.status));
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, updateStatus };