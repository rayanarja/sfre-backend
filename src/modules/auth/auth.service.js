const prisma = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const register = async ({ username, email, password, phone, role }) => {
  const existingEmail = await prisma.users.findUnique({ where: { email } });
  if (existingEmail) throw { status: 400, message: 'الإيميل مستخدم مسبقاً' };

  const existingUsername = await prisma.users.findUnique({ where: { username } });
  if (existingUsername) throw { status: 400, message: 'اسم المستخدم مستخدم مسبقاً' };

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.users.create({
    data: { username, email, password: hashedPassword, phone, role }
  });

  return {
    message: 'تم التسجيل بنجاح',
    user: {
      id: user.user_id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
    }
  };
};

// تسجيل دخول بالإيميل (للراكب والأدمن)
const login = async (email, password) => {
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) throw { status: 404, message: 'الإيميل أو كلمة المرور غلط' };

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw { status: 400, message: 'الإيميل أو كلمة المرور غلط' };

  const token = jwt.sign(
    { id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    message: 'تم تسجيل الدخول بنجاح',
    token,
    user: {
      id: user.user_id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      must_change_password: user.must_change_password,
    }
  };
};
const loginByPhone = async (phone, password) => {
  // تطبيع الرقم
  let normalized = phone.replace(/[\s\-()]/g, '');
  if (normalized.startsWith('+963')) normalized = '0' + normalized.slice(4);
  else if (normalized.startsWith('00963')) normalized = '0' + normalized.slice(5);
  else if (normalized.startsWith('963')) normalized = '0' + normalized.slice(3);

  const user = await prisma.users.findFirst({ where: { phone: normalized } });
  if (!user) throw { status: 404, message: 'رقم الهاتف أو كلمة المرور غلط' };
  if (user.role !== 'driver') throw { status: 403, message: 'هذا الدخول مخصص للسائقين فقط' };

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw { status: 400, message: 'رقم الهاتف أو كلمة المرور غلط' };

  // جيب بيانات السائق
  const driver = await prisma.drivers.findUnique({
    where: { user_id: user.user_id },
    include: { shifts: { include: { bus: true }, orderBy: { date: 'desc' }, take: 5 } }
  });

  const token = jwt.sign(
    { id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    message: 'تم تسجيل الدخول بنجاح',
    token,
    user: {
      id: user.user_id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      role: user.role,
      must_change_password: user.must_change_password,
    },
    driver: driver ? {
      driver_id: driver.driver_id,
      status: driver.status,
      shifts: driver.shifts,
    } : null,
  };
};


// تغيير كلمة المرور
const changePassword = async (userId, oldPassword, newPassword) => {
  const user = await prisma.users.findUnique({ where: { user_id: parseInt(userId) } });
  if (!user) throw { status: 404, message: 'المستخدم غير موجود' };

  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) throw { status: 400, message: 'كلمة المرور القديمة غلط' };

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.users.update({
    where: { user_id: parseInt(userId) },
    data: { password: hashedPassword, must_change_password: false },
  });

  return { message: 'تم تغيير كلمة المرور بنجاح' };
};

module.exports = { register, login, loginByPhone, changePassword };