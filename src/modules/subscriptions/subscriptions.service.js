const prisma = require('../../config/database');

// ===== جلب الاشتراكات =====

const getAllSubscriptions = async () => {
  return await prisma.subscriptions.findMany({
    include: {
      user: { select: { user_id: true, username: true, email: true, phone: true } },
      plan: true,
      family_members: {
        include: { user: { select: { user_id: true, username: true, email: true } } }
      },
    },
    orderBy: { created_at: 'desc' },
  });
};

const getSubscriptionById = async (id) => {
  const sub = await prisma.subscriptions.findUnique({
    where: { subscription_id: parseInt(id) },
    include: {
      user: true,
      plan: true,
      family_members: {
        include: { user: { select: { user_id: true, username: true, email: true } } }
      },
    },
  });
  if (!sub) throw { status: 404, message: 'الاشتراك غير موجود' };
  return sub;
};

const getUserSubscription = async (user_id) => {
  const uid = parseInt(user_id);
  const now = new Date();

  // أولاً: هل عندو اشتراك مباشر نشط؟
  let sub = await prisma.subscriptions.findFirst({
    where: {
      user_id: uid,
      status: 'active',
      end_date: { gte: now },
    },
    include: {
      plan: true,
      family_members: {
        include: { user: { select: { user_id: true, username: true, email: true } } }
      },
    },
    orderBy: { created_at: 'desc' },
  });

  if (sub) return sub;

  // ثانياً: هل هو عضو بعائلة؟
  const familyMember = await prisma.family_Members.findFirst({
    where: { user_id: uid },
    include: {
      subscription: {
        include: {
          plan: true,
          user: { select: { user_id: true, username: true } },
          family_members: {
            include: { user: { select: { user_id: true, username: true, email: true } } }
          },
        },
      },
    },
  });

  if (familyMember && familyMember.subscription.status === 'active' && new Date(familyMember.subscription.end_date) >= now) {
    return { ...familyMember.subscription, is_family_member: true };
  }

  return null;
};

// ===== إنشاء اشتراك =====

const createSubscription = async (data) => {
  const userId = parseInt(data.user_id);
  const planId = parseInt(data.plan_id);

  const plan = await prisma.subscription_Plans.findUnique({ where: { plan_id: planId } });
  if (!plan) throw { status: 404, message: 'الخطة غير موجودة' };
  if (!plan.is_active) throw { status: 400, message: 'هذه الخطة غير متاحة حالياً' };

  const existing = await prisma.subscriptions.findFirst({
    where: {
      user_id: userId,
      status: 'active',
      end_date: { gte: new Date() },
    },
  });
  if (existing) throw { status: 400, message: 'عندك اشتراك نشط — انتظر حتى ينتهي أو ألغيه' };

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + (plan.duration_days || 30));

  return await prisma.subscriptions.create({
    data: {
      user_id: userId,
      plan_id: planId,
      start_date: startDate,
      end_date: endDate,
      trips_used: 0,
      trips_limit: plan.trip_limit,
      max_users: plan.max_users,
      status: 'active',
    },
    include: { plan: true },
  });
};

// ===== استخدام رحلة =====

const useTrip = async (user_id) => {
  const sub = await getUserSubscription(user_id);
  if (!sub) throw { status: 400, message: 'ما عندك اشتراك نشط' };
  if (sub.trips_used >= sub.trips_limit) throw { status: 400, message: 'انتهت رحلاتك — جدد اشتراكك' };

  return await prisma.subscriptions.update({
    where: { subscription_id: sub.subscription_id },
    data: { trips_used: { increment: 1 } },
    include: { plan: true },
  });
};

// ===== إدارة أعضاء العائلة =====

const addFamilyMember = async (subscription_id, email) => {
  const subId = parseInt(subscription_id);

  const sub = await prisma.subscriptions.findUnique({
    where: { subscription_id: subId },
    include: { family_members: true },
  });
  if (!sub) throw { status: 404, message: 'الاشتراك غير موجود' };
  if (sub.status !== 'active') throw { status: 400, message: 'الاشتراك غير نشط' };

  if (sub.family_members.length + 1 >= sub.max_users) {
    throw { status: 400, message: `وصلت للحد الأقصى — ${sub.max_users} مستخدمين` };
  }

  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) throw { status: 404, message: 'المستخدم غير موجود — تأكد من الإيميل' };
  if (user.user_id === sub.user_id) throw { status: 400, message: 'ما فيك تضيف نفسك' };

  const existing = await prisma.family_Members.findUnique({
    where: { subscription_id_user_id: { subscription_id: subId, user_id: user.user_id } },
  });
  if (existing) throw { status: 400, message: 'هذا المستخدم مضاف مسبقاً' };

  return await prisma.family_Members.create({
    data: { subscription_id: subId, user_id: user.user_id },
    include: { user: { select: { user_id: true, username: true, email: true } } },
  });
};

const removeFamilyMember = async (member_id) => {
  return await prisma.family_Members.delete({
    where: { member_id: parseInt(member_id) },
  });
};

// ===== تعديل / إلغاء =====

const updateSubscription = async (id, data) => {
  return await prisma.subscriptions.update({
    where: { subscription_id: parseInt(id) },
    data,
    include: { plan: true },
  });
};

const cancelSubscription = async (id) => {
  return await prisma.subscriptions.update({
    where: { subscription_id: parseInt(id) },
    data: { status: 'cancelled' },
  });
};

const deleteSubscription = async (id) => {
  const subId = parseInt(id);
  await prisma.family_Members.deleteMany({ where: { subscription_id: subId } });
  return await prisma.subscriptions.delete({ where: { subscription_id: subId } });
};

module.exports = {
  getAllSubscriptions,
  getSubscriptionById,
  getUserSubscription,
  createSubscription,
  useTrip,
  addFamilyMember,
  removeFamilyMember,
  updateSubscription,
  cancelSubscription,
  deleteSubscription,
};