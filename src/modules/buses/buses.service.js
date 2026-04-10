const prisma = require('../../config/database');

const getAllBuses = async () => {
  return await prisma.buses.findMany({
    include: { route: true }
  });
};

const getBusById = async (id) => {
  const bus = await prisma.buses.findUnique({
    where: { bus_id: parseInt(id) },
    include: { route: true }
  });
  if (!bus) throw { status: 404, message: 'الباص غير موجود' };
  return bus;
};

const createBus = async (data) => {
  return await prisma.buses.create({
    data,
    include: { route: true }
  });
};

const updateBus = async (id, data) => {
  const busId = parseInt(id);
  
  // جيب الحالة القديمة
  const oldBus = await prisma.buses.findUnique({ where: { bus_id: busId }, include: { route: true } });
  
  const updated = await prisma.buses.update({
    where: { bus_id: busId },
    data,
    include: { route: true },
  });

  // ═══ إشعارات ذكية عند تغيير الحالة ═══
  const oldStatus = oldBus?.current_status;
  const newStatus = updated.current_status;
  
  if (oldStatus !== newStatus && oldStatus && newStatus) {
    const { emitNotification } = require('../../socket');
    const routeName = updated.route?.route_name?.replace(/[\s\-_]*(ذهاب|إياب|اياب)/g, '').trim() || '';

    // ═══ الباص توقف (صيانة أو عطل) ═══
    if ((newStatus === 'maintenance' || newStatus === 'breakdown') && oldStatus === 'active') {
      const statusAr = newStatus === 'maintenance' ? 'صيانة' : 'عطل';
      
      // إشعار للسائق المعيّن على هالباص تحديداً
      const activeShift = await prisma.shifts.findFirst({
        where: { bus_id: busId, status: { in: ['active', 'scheduled'] } },
        include: { driver: true },
      });
      if (activeShift?.driver?.user_id) {
        const driverNotif = await prisma.notifications.create({
          data: {
            type: 'personal',
            recipient_id: activeShift.driver.user_id,
            message: `⚠️ الباص ${updated.plate_number} تم تحويله لحالة ${statusAr} — أوقف الدوام`,
            sender_type: 'admin',
          },
        });
        emitNotification('personal', driverNotif);
      }
    }

    // ═══ الباص رجع للخدمة ═══
    if (newStatus === 'active' && (oldStatus === 'maintenance' || oldStatus === 'breakdown')) {
      const activeShift = await prisma.shifts.findFirst({
        where: { bus_id: busId, status: { in: ['active', 'scheduled'] } },
        include: { driver: true },
      });
      if (activeShift?.driver?.user_id) {
        const driverNotif = await prisma.notifications.create({
          data: {
            type: 'personal',
            recipient_id: activeShift.driver.user_id,
            message: `✅ الباص ${updated.plate_number} جاهز للخدمة — تقدر تبدأ الدوام`,
            sender_type: 'admin',
          },
        });
        emitNotification('personal', driverNotif);
      }
    }
  }

  return updated;
};
const deleteBus = async (id) => {
  const busId = parseInt(id);

  // احذف كل البيانات المرتبطة
  await prisma.driver_Activity_Log.deleteMany({ where: { bus_id: busId } });
  await prisma.trip_History.deleteMany({ where: { bus_id: busId } });
  await prisma.shifts.deleteMany({ where: { bus_id: busId } });
  await prisma.bus_Tracking_Log.deleteMany({ where: { bus_id: busId } });
  await prisma.reports.deleteMany({ where: { bus_id: busId } });
  await prisma.issues.deleteMany({ where: { bus_id: busId } });
  await prisma.lost_Items.deleteMany({ where: { bus_id: busId } });

  return await prisma.buses.delete({ where: { bus_id: busId } });
};

const getNearbyBuses = async (station_id) => {
  const station = await prisma.stations.findUnique({
    where: { station_id: parseInt(station_id) }
  });
  if (!station) throw { status: 404, message: 'الموقف غير موجود' };

  return await prisma.buses.findMany({
    where: {
      route_id: station.route_id,
      current_status: 'active'
    },
    include: { route: true }
  });
};

const generateQR = async (bus_id) => {
  const bus = await prisma.buses.findUnique({
    where: { bus_id: parseInt(bus_id) }
  });
  if (!bus) throw { status: 404, message: 'الباص غير موجود' };
  return {
    qr_data: `BUS-${bus.bus_id}-${bus.plate_number}`,
    bus_id: bus.bus_id,
    plate_number: bus.plate_number
  };
};
const verifyQR = async (qr_data, user_id) => {
  const uid = parseInt(user_id);

  // 1. تحقق من صيغة QR
  const parts = qr_data.split('-');
  if (parts[0] !== 'BUS') throw { status: 400, message: 'QR غير صالح' };
  const bus_id = parseInt(parts[1]);

  // 2. تحقق من الباص
  const bus = await prisma.buses.findUnique({
    where: { bus_id },
    include: { route: true },
  });
  if (!bus) throw { status: 404, message: 'الباص غير موجود' };

  // 3. تحقق من الاشتراك (مباشر أو عائلي)
  let subscription = await prisma.subscriptions.findFirst({
    where: {
      user_id: uid,
      status: 'active',
      end_date: { gte: new Date() },
    },
    include: { plan: true },
  });

  // إذا ما عندو اشتراك مباشر — جرّب عائلي
  if (!subscription) {
    const familyMember = await prisma.family_Members.findFirst({
      where: { user_id: uid },
      include: {
        subscription: { include: { plan: true } },
      },
    });
    if (familyMember && familyMember.subscription.status === 'active' && new Date(familyMember.subscription.end_date) >= new Date()) {
      subscription = familyMember.subscription;
    }
  }

  if (!subscription) throw { status: 403, message: 'لا يوجد اشتراك فعّال — اشترك أولاً' };

  // 4. تحقق من عدد الرحلات
  if (subscription.trips_used >= subscription.trips_limit) {
    throw { status: 400, message: 'انتهت رحلاتك — جدد اشتراكك' };
  }

  // 5. خصم رحلة
  const updated = await prisma.subscriptions.update({
    where: { subscription_id: subscription.subscription_id },
    data: { trips_used: { increment: 1 } },
  });

  // 6. سجّل بسجل الرحلات
  await prisma.trip_History.create({
    data: {
      user_id: uid,
      bus_id: bus_id,
      route_name: bus.route?.route_name || null,
      from_station: null,
      boarded_at: new Date(),
    },
  });

  return {
    message: `تم الركوب بنجاح — ${bus.plate_number} 🚌`,
    bus_id: bus.bus_id,
    plate_number: bus.plate_number,
    route_name: bus.route?.route_name || null,
    plan_name: subscription.plan?.name || '',
    trips_used: updated.trips_used,
    trips_limit: updated.trips_limit,
    trips_remaining: updated.trips_limit - updated.trips_used,
  };
};

module.exports = {
  getAllBuses,
  getBusById,
  createBus,
  updateBus,
  deleteBus,
  getNearbyBuses,
  generateQR,
  verifyQR
};