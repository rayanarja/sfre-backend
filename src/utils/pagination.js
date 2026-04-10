/**
 * Pagination — يُستخدم بكل endpoint يرجع قائمة
 *
 * الاستخدام:
 *   const { skip, take, page, limit } = paginate(req.query);
 *   const data = await prisma.users.findMany({ skip, take });
 *   res.json(paginatedResponse(data, totalCount, page, limit));
 */

const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { skip, take: limit, page, limit };
};

const paginatedResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};

module.exports = { paginate, paginatedResponse };
