const prisma = require('../../config/database');

const createReport = async (data) => {
  // البلاغ يتسجل بقسم البلاغات فقط — ما بيطلع بالإشعارات
  return await prisma.reports.create({ data });
};

const getAllReports = async () => {
  return await prisma.reports.findMany({
    include: { user: true, bus: true },
    orderBy: { created_at: 'desc' },
  });
};

const updateReportStatus = async (id, status) => {
  // ReportStatus: pending, reviewed, resolved
  return await prisma.reports.update({
    where: { report_id: parseInt(id) },
    data: { status },
    include: { user: true },
  });
};

const deleteReport = async (id) => {
  return await prisma.reports.delete({ where: { report_id: parseInt(id) } });
};

module.exports = { getAllReports, updateReportStatus, deleteReport, createReport };
