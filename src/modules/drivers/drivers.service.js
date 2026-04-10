const prisma = require('../../config/database');

// التحقق من رقم الهاتف السوري
const validateSyrianPhone = (phone) => {
  if (!phone) return { valid: false, message: 'رقم الهاتف مطلوب' };
  const cleaned = phone.replace(/[\s\-()]/g, '');
  const patterns = [
    /^09\d{8}$/,
    /^\+9639\d{8}$/,
    /^009639\d{8}$/,
    /^9639\d{8}$/,
  ];
  const isValid = patterns.some(p => p.test(cleaned));
  if (!isValid) {
    return { valid: false, message: 'رقم الهاتف لازم يكون سوري — مثال: 0912345678' };
  }
  let normalized = cleaned;
  if (cleaned.startsWith('+963')) normalized = '0' + cleaned.slice(4);
  else if (cleaned.startsWith('00963')) normalized = '0' + cleaned.slice(5);
  else if (cleaned.startsWith('963')) normalized = '0' + cleaned.slice(3);
  return { valid: true, normalized };
};

const getAllDrivers = async () => {
  return await prisma.drivers.findMany({
    include: {
      user: {
        select: { user_id: true, username: true, email: true, phone: true, role: true }
      },
      shifts: {
        include: { bus: true },
        orderBy: { date: 'desc' },
        take: 1
      }
    }
  });
};

const getDriverById = async (id) => {
  const driver = await prisma.drivers.findUnique({
    where: { driver_id: parseInt(id) },
    include: {
      user: {
        select: { user_id: true, username: true, email: true, phone: true, role: true }
      },
      shifts: { include: { bus: true }, orderBy: { date: 'desc' }, take: 1 }
    }
  });
  if (!driver) throw { status: 404, message: 'السائق غير موجود' };
  return driver;
};

const createDriver = async (data) => {
  const bcrypt = require('bcryptjs');

  // التحقق من رقم الهاتف السوري
  const phoneCheck = validateSyrianPhone(data.phone);
  if (!phoneCheck.valid) {
    throw { status: 400, message: phoneCheck.message };
  }

  const existingPhone = await prisma.users.findFirst({
    where: { phone: phoneCheck.normalized }
  });
  if (existingPhone) {
    throw { status: 400, message: 'رقم الهاتف مستخدم مسبقاً' };
  }

  // 1. أنشئ المستخدم
  const user = await prisma.users.create({
    data: {
      username: data.username,
      email:    data.email,
      password: await bcrypt.hash(data.password || 'driver123', 10),
      phone:    phoneCheck.normalized,
      role:     'driver',
      must_change_password: true,
    }
  });

  // 2. أنشئ السائق مرتبط بالمستخدم
  return await prisma.drivers.create({
    data: { user_id: user.user_id },
    include: { user: true }
  });
};

const updateDriver = async (id, data) => {
  if (data.phone) {
    const phoneCheck = validateSyrianPhone(data.phone);
    if (!phoneCheck.valid) {
      throw { status: 400, message: phoneCheck.message };
    }
    data.phone = phoneCheck.normalized;
  }

  return await prisma.drivers.update({
    where: { driver_id: parseInt(id) },
    data,
    include: { user: true }
  });
};

const deleteDriver = async (id) => {
  const driverId = parseInt(id);

  const driver = await prisma.drivers.findUnique({
    where: { driver_id: driverId },
    include: {
      shifts: {
        where: {
          status: { in: ['scheduled', 'active'] }
        },
        include: { bus: true }
      }
    }
  });

  if (!driver) throw { status: 404, message: 'السائق غير موجود' };

  for (const shift of driver.shifts) {
    await prisma.buses.update({
      where: { bus_id: shift.bus_id },
      data: { current_status: 'inactive' }
    });
  }

  await prisma.shifts.deleteMany({
    where: { driver_id: driverId }
  });

  await prisma.drivers.delete({
    where: { driver_id: driverId }
  });

  await prisma.users.update({
    where: { user_id: driver.user_id },
    data: { role: 'passenger' }
  });

  return { message: 'تم حذف السائق وتحرير الباصات المرتبطة' };
};

module.exports = { getAllDrivers, getDriverById, createDriver, updateDriver, deleteDriver };