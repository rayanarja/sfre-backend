const reportsService = require('./reports.service');
const create = async (req, res, next) => {
  try {
    res.status(201).json(await reportsService.createReport(req.body));
  } catch (err) { next(err); }
};

const getAll = async (req, res, next) => {
  try { res.json(await reportsService.getAllReports()); }
  catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try { res.json(await reportsService.updateReportStatus(req.params.id, req.body.status)); }
  catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await reportsService.deleteReport(req.params.id);
    res.json({ message: 'تم حذف التقرير بنجاح' });
  } catch (err) { next(err); }
};

module.exports = { getAll, updateStatus, remove,create };