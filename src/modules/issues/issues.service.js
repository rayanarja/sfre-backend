const prisma = require('../../config/database');

const getAllIssues = async () => {
  return await prisma.issues.findMany({ include: { bus: true, user: true }, orderBy: { created_at: 'desc' } });
};
const getIssueById = async (id) => {
  const issue = await prisma.issues.findUnique({ where: { issue_id: parseInt(id) }, include: { bus: true, user: true } });
  if (!issue) throw { status: 404, message: 'العطل غير موجود' };
  return issue;
};
const createIssue = async (data) => {
  return await prisma.issues.create({ data });
};
const deleteIssue = async (id) => {
  return await prisma.issues.delete({ where: { issue_id: parseInt(id) } });
};
const updateIssueStatus = async (id, status) => {
  // IssueStatus: pending, in_progress, resolved
  const validMap = {
    'pending': 'pending',
    'in_progress': 'in_progress',
    'resolved': 'resolved',
    'reviewed': 'in_progress',  // ← الداشبورد بيبعث reviewed — نحوّلها
    'new': 'pending',
  };
  const mapped = validMap[status] || 'pending';
  return await prisma.issues.update({
    where: { issue_id: parseInt(id) },
    data: { status: mapped },
  });
};
module.exports = { getAllIssues, getIssueById, createIssue, deleteIssue, updateIssueStatus };
