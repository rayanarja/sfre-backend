const prisma = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// === إدارة نقاط البيع ===

const getAllPOS = async () => {
  return await prisma.pOS_Points.findMany({
    orderBy: { created_at: 'desc' },
  });
};

const getPOSById = async (id) => {
  const pos = await prisma.pOS_Points.findUnique({ where: { pos_id: parseInt(id) } });
  if (!pos) throw { status: 404, message: 'نقطة البيع غير موجودة' };
  return pos;
};

const createPOS = async (data) => {
 if (data.email) {
    const existing = await prisma.pOS_Points.findUnique({ where: { email: data.email } });
    if (existing) throw { status: 400, message: 'الإيميل مستخدم' };
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  return await prisma.pOS_Points.create({
    data: {
      name: data.name,
      owner_name: data.owner_name,
      phone: data.phone,
      email: data.email,
      password: hashedPassword,
      lat: data.lat ? parseFloat(data.lat) : null,
      lng: data.lng ? parseFloat(data.lng) : null,
      balance: 0,
    },
  });
};

const updatePOS = async (id, data) => {
  return await prisma.pOS_Points.update({
    where: { pos_id: parseInt(id) },
    data,
  });
};

const deletePOS = async (id) => {
  await prisma.pOS_Transactions.deleteMany({ where: { pos_id: parseInt(id) } });
  return await prisma.pOS_Points.delete({ where: { pos_id: parseInt(id) } });
};

// === شحن رصيد (من الأدمن) ===

const rechargeBalance = async (pos_id, amount) => {
  const pos = await prisma.pOS_Points.findUnique({ where: { pos_id: parseInt(pos_id) } });
  if (!pos) throw { status: 404, message: 'نقطة البيع غير موجودة' };

  await prisma.pOS_Points.update({
    where: { pos_id: parseInt(pos_id) },
    data: { balance: { increment: parseFloat(amount) } },
  });

  await prisma.pOS_Transactions.create({
    data: {
      pos_id: parseInt(pos_id),
      type: 'recharge',
      amount: parseFloat(amount),
      description: `شحن رصيد ${amount} ل.س`,
    },
  });

  return { message: `تم شحن ${amount} ل.س بنجاح` };
};

// === تسجيل دخول نقطة البيع ===
const loginPOS = async (phone, password) => {
  // طبّع الرقم
  let normalizedPhone = phone;
  if (phone.startsWith('+963')) normalizedPhone = '0' + phone.slice(4);
  else if (phone.startsWith('00963')) normalizedPhone = '0' + phone.slice(5);
  else if (phone.startsWith('963')) normalizedPhone = '0' + phone.slice(3);

  const pos = await prisma.pOS_Points.findFirst({ where: { phone: normalizedPhone } });
  if (!pos) throw { status: 404, message: 'الحساب غير موجود — تأكد من الرقم' };
  if (!pos.is_active) throw { status: 403, message: 'الحساب معطّل — تواصل مع الإدارة' };

  const isMatch = await bcrypt.compare(password, pos.password);
  if (!isMatch) throw { status: 400, message: 'كلمة المرور غلط' };

  const token = jwt.sign(
    { id: pos.pos_id, email: pos.email, role: 'pos' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );

  return {
    token,
    pos: {
      id: pos.pos_id,
      name: pos.name,
      owner_name: pos.owner_name,
      phone: pos.phone,
      balance: pos.balance,
      must_change_password: pos.must_change_password || false,
    },
  };
};
// === بيع اشتراك (من نقطة البيع) ===

const sellSubscription = async (pos_id, user_email, plan_id) => {
  const pos = await prisma.pOS_Points.findUnique({ where: { pos_id: parseInt(pos_id) } });
  if (!pos) throw { status: 404, message: 'نقطة البيع غير موجودة' };

  const plan = await prisma.subscription_Plans.findUnique({ where: { plan_id: parseInt(plan_id) } });
  if (!plan) throw { status: 404, message: 'الخطة غير موجودة' };

  // تحقق من الرصيد
  if (pos.balance < plan.price) {
    throw { status: 400, message: `رصيدك غير كافي — بدك ${plan.price} ل.س ورصيدك ${pos.balance} ل.س` };
  }

  // جيب المستخدم
  const user = await prisma.users.findFirst({ where: { email: user_email } });
  if (!user) throw { status: 404, message: 'المستخدم غير موجود — تأكد من الإيميل' };

  // ألغِ أي اشتراك قديم
  await prisma.subscriptions.updateMany({
    where: { user_id: user.user_id, status: 'active' },
    data: { status: 'expired' },
  });

  // أنشئ الاشتراك
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + (plan.duration_days || 30));

  const subscription = await prisma.subscriptions.create({
    data: {
      user_id: user.user_id,
      plan_id: plan.plan_id,
      start_date: now,
      end_date: endDate,
      trips_used: 0,
      trips_limit: plan.trip_limit,
      max_users: plan.max_users,
      status: 'active',
    },
  });

  // اخصم من رصيد نقطة البيع
  await prisma.pOS_Points.update({
    where: { pos_id: parseInt(pos_id) },
    data: { balance: { decrement: plan.price } },
  });

  // سجّل المعاملة
  await prisma.pOS_Transactions.create({
    data: {
      pos_id: parseInt(pos_id),
      type: 'sale',
      amount: plan.price,
      description: `بيع اشتراك ${plan.name} للمستخدم ${user.email}`,
      subscription_id: subscription.subscription_id,
    },
  });

  return {
    message: `تم تفعيل اشتراك ${plan.name} لـ ${user.username}`,
    subscription_id: subscription.subscription_id,
    remaining_balance: pos.balance - plan.price,
  };
};

// === سجل المعاملات ===

const getTransactions = async (pos_id) => {
  return await prisma.pOS_Transactions.findMany({
    where: { pos_id: parseInt(pos_id) },
    orderBy: { created_at: 'desc' },
  });
};

// === نقاط البيع النشطة (للراكب — خريطة) ===

const getActivePOS = async () => {
  return await prisma.pOS_Points.findMany({
    where: { is_active: true, lat: { not: null }, lng: { not: null } },
    select: { pos_id: true, name: true, owner_name: true, phone: true, lat: true, lng: true },
  });
};
const changePassword = async (pos_id, oldPassword, newPassword) => {
  const pos = await prisma.pOS_Points.findUnique({ where: { pos_id: parseInt(pos_id) } });
  if (!pos) throw { status: 404, message: 'نقطة البيع غير موجودة' };

  const isMatch = await bcrypt.compare(oldPassword, pos.password);
  if (!isMatch) throw { status: 400, message: 'كلمة المرور القديمة غلط' };

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.pOS_Points.update({
    where: { pos_id: parseInt(pos_id) },
    data: { password: hashed, must_change_password: false },
  });

  return { message: 'تم تغيير كلمة المرور بنجاح' };
};

module.exports = {
  getAllPOS, getPOSById, createPOS, updatePOS, deletePOS,
  rechargeBalance, loginPOS, sellSubscription, getTransactions, getActivePOS, changePassword,
};