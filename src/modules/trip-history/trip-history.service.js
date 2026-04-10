const prisma = require('../../config/database');

// جلب سجل رحلات الراكب + إغلاق تلقائي للرحلات القديمة
const getUserTrips = async (user_id) => {
  // أغلق أي رحلة مفتوحة أقدم من ساعتين
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await prisma.trip_History.updateMany({
    where: {
      user_id: parseInt(user_id),
      exited_at: null,
      boarded_at: { lt: twoHoursAgo },
    },
    data: { exited_at: twoHoursAgo, to_station: 'إغلاق تلقائي' },
  });

  return await prisma.trip_History.findMany({
    where: { user_id: parseInt(user_id) },
    include: { bus: { select: { bus_id: true, plate_number: true } } },
    orderBy: { boarded_at: 'desc' },
    take: 50,
  });
};

// تسجيل ركوب — الوجهة اختيارية
const boardBus = async (data) => {
  // أغلق أي رحلة مفتوحة سابقة لنفس الراكب
  await prisma.trip_History.updateMany({
    where: { user_id: parseInt(data.user_id), exited_at: null },
    data: { exited_at: new Date(), to_station: data.from_station || 'إغلاق تلقائي' },
  });

  return await prisma.trip_History.create({
    data: {
      user_id: parseInt(data.user_id),
      bus_id: parseInt(data.bus_id),
      route_name: data.route_name || null,
      from_station: data.from_station || null,
    },
    include: { bus: { select: { plate_number: true } } },
  });
};

// تسجيل نزول
const exitBus = async (trip_id, data) => {
  return await prisma.trip_History.update({
    where: { trip_id: parseInt(trip_id) },
    data: { to_station: data.to_station || null, exited_at: new Date() },
    include: { bus: { select: { plate_number: true } } },
  });
};

// جلب كل الرحلات (للأدمن)
const getAllTrips = async () => {
  return await prisma.trip_History.findMany({
    include: {
      user: { select: { user_id: true, username: true, email: true } },
      bus: { select: { bus_id: true, plate_number: true } },
    },
    orderBy: { boarded_at: 'desc' },
    take: 200,
  });
};

module.exports = { getUserTrips, boardBus, exitBus, getAllTrips };
