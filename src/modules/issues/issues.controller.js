const issuesService = require('./issues.service');

const getAll = async (req, res, next) => {
  try { res.json(await issuesService.getAllIssues()); }
  catch (err) { next(err); }
};
const getOne = async (req, res, next) => {
  try { res.json(await issuesService.getIssueById(req.params.id)); }
  catch (err) { next(err); }
};
const create = async (req, res, next) => {
  try { res.status(201).json(await issuesService.createIssue(req.body)); }
  catch (err) { next(err); }
};
const remove = async (req, res, next) => {
  try {
    await issuesService.deleteIssue(req.params.id);
    res.json({ message: 'تم حذف العطل بنجاح' });
  } catch (err) { next(err); }
};
const updateStatus = async (req, res, next) => {
  try { res.json(await issuesService.updateIssueStatus(req.params.id, req.body.status)); }
  catch (err) { next(err); }
};
module.exports = { getAll, getOne, create, remove ,updateStatus};