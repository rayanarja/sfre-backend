const prisma = require('../../config/database');

const getAllRoutes = async () => {
  return await prisma.routes.findMany({
    include: {
      stations: { orderBy: { order_index: 'asc' } },
      buses: true,
    },
    orderBy: { route_id: 'asc' },
  });
};

const getRouteById = async (id) => {
  const route = await prisma.routes.findUnique({
    where: { route_id: parseInt(id) },
    include: {
      stations: { orderBy: { order_index: 'asc' } },
      buses: true,
    },
  });
  if (!route) throw { status: 404, message: 'الخط غير موجود' };
  return route;
};

const createRoute = async (data) => {
  return await prisma.routes.create({
    data: {
      route_name: data.route_name,
      description: data.description || null,
      pair_route_id: data.pair_route_id ? parseInt(data.pair_route_id) : null,
    },
  });
};

const updateRoute = async (id, data) => {
  const updateData = {};
  if (data.route_name !== undefined) updateData.route_name = data.route_name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.pair_route_id !== undefined) {
    updateData.pair_route_id = data.pair_route_id ? parseInt(data.pair_route_id) : null;
  }
  return await prisma.routes.update({
    where: { route_id: parseInt(id) },
    data: updateData,
  });
};

/**
 * ربط خطين ببعض (ذهاب ↔ إياب)
 * بيحدث الاثنين — كل واحد يشير للثاني
 */
const linkRoutes = async (route1_id, route2_id) => {
  const id1 = parseInt(route1_id);
  const id2 = parseInt(route2_id);

  const r1 = await prisma.routes.findUnique({ where: { route_id: id1 } });
  const r2 = await prisma.routes.findUnique({ where: { route_id: id2 } });
  if (!r1 || !r2) throw { status: 404, message: 'أحد الخطين غير موجود' };
  if (id1 === id2) throw { status: 400, message: 'ما فيك تربط خط بنفسو' };

  await prisma.routes.update({ where: { route_id: id1 }, data: { pair_route_id: id2 } });
  await prisma.routes.update({ where: { route_id: id2 }, data: { pair_route_id: id1 } });

  return { message: `تم ربط "${r1.route_name}" مع "${r2.route_name}"` };
};

/**
 * فك ربط خطين
 */
const unlinkRoutes = async (route_id) => {
  const id = parseInt(route_id);
  const route = await prisma.routes.findUnique({ where: { route_id: id } });
  if (!route) throw { status: 404, message: 'الخط غير موجود' };

  if (route.pair_route_id) {
    await prisma.routes.update({ where: { route_id: route.pair_route_id }, data: { pair_route_id: null } });
  }
  await prisma.routes.update({ where: { route_id: id }, data: { pair_route_id: null } });

  return { message: 'تم فك الربط' };
};

const deleteRoute = async (id) => {
  const routeId = parseInt(id);
  const route = await prisma.routes.findUnique({ where: { route_id: routeId } });

  // فك ربط الخط المعاكس قبل الحذف
  if (route?.pair_route_id) {
    await prisma.routes.update({
      where: { route_id: route.pair_route_id },
      data: { pair_route_id: null },
    });
  }

  // حذف المواقف المرتبطة
  await prisma.stations.deleteMany({ where: { route_id: routeId } });

  return await prisma.routes.delete({ where: { route_id: routeId } });
};

module.exports = { getAllRoutes, getRouteById, createRoute, updateRoute, deleteRoute, linkRoutes, unlinkRoutes };
