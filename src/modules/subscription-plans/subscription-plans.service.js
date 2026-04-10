const prisma = require('../../config/database');

const getAllPlans = async () => {
  return await prisma.subscription_Plans.findMany({
    where: { is_active: true },
    orderBy: { price: 'asc' },
  });
};

const getPlanById = async (id) => {
  const plan = await prisma.subscription_Plans.findUnique({
    where: { plan_id: parseInt(id) },
  });
  if (!plan) throw { status: 404, message: 'الخطة غير موجودة' };
  return plan;
};

const createPlan = async (data) => {
  return await prisma.subscription_Plans.create({
    data: {
      name: data.name,
      trip_limit: parseInt(data.trip_limit),
      price: parseFloat(data.price),
      max_users: parseInt(data.max_users) || 1,
      duration_days: parseInt(data.duration_days) || 30,
      description: data.description || null,
    },
  });
};

const updatePlan = async (id, data) => {
  return await prisma.subscription_Plans.update({
    where: { plan_id: parseInt(id) },
    data,
  });
};

const deletePlan = async (id) => {
  return await prisma.subscription_Plans.update({
    where: { plan_id: parseInt(id) },
    data: { is_active: false },
  });
};

module.exports = { getAllPlans, getPlanById, createPlan, updatePlan, deletePlan };