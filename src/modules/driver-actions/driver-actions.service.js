const prisma = require('../../config/database');
const { emitNotification, emitBusStatus, emitShiftUpdate } = require('../../socket');

// ═══════════════════════════════════════════════
// تحديث حالة الباص
// ═══════════════════════════════════════════════
const updateBusStatus = async (bus_id, status, driver_id) => {
  const bus = await prisma.buses.findUnique({ where: { bus_id: parseInt(bus_id) } });
  if (!bus) throw { status: 404, message: 'الباص غير موجود' };

  const updated = await prisma.buses.update({
    where: { bus_id: parseInt(bus_id) },
    data: { current_status: status },
  });

  emitBusStatus(parseInt(bus_id), status);
  return updated;
};

// ═══════════════════════════════════════════════
// إرسال تنبيه تأخير
// الإشعار يروح للأدمن + الركاب — بدون باقي السائقين
// ═══════════════════════════════════════════════
const sendDelayAlert = async ({ driver_id, bus_id, station_name, reason }) => {
  const bus = await prisma.buses.findUnique({ where: { bus_id: parseInt(bus_id) } });
  if (!bus) throw { status: 404, message: 'الباص غير موجود' };

  const driver = await prisma.drivers.findUnique({
    where: { driver_id: parseInt(driver_id) },
    include: { user: true },
  });
  const driverName = driver?.user?.username || 'سائق';

  // إشعار للأدمن (تفصيلي)
  const adminNotif = await prisma.notifications.create({
    data: {
      type: 'admin',
      message: `⏰ السائق ${driverName} أبلغ عن تأخير — الباص ${bus.plate_number}${reason ? ' — ' + reason : ''}`,
      sender_type: 'driver',
      sender_id: parseInt(driver_id),
      is_read: false,
    },
  });

  // إشعار للركاب فقط (بسيط ومهذب)
  const passengerNotif = await prisma.notifications.create({
    data: {
      type: 'passenger',
      message: `⏰ الباص ${bus.plate_number} رح يتأخر شوي. نعتذر عن التأخير.`,
      sender_type: 'system',
      sender_id: null,
      is_read: false,
    },
  });

  // ← Real-time
  emitNotification('admin', adminNotif);
  emitNotification('passenger', passengerNotif);

  return { message: 'تم إرسال تنبيه التأخير' };
};

// ═══════════════════════════════════════════════
// طلب باص إضافي — إشعار للأدمن بس
// ═══════════════════════════════════════════════
const requestExtraBus = async ({ driver_id, bus_id, route_name, note }) => {
  const bus = await prisma.buses.findUnique({ where: { bus_id: parseInt(bus_id) } });
  if (!bus) throw { status: 404, message: 'الباص غير موجود' };

  const driver = await prisma.drivers.findUnique({
    where: { driver_id: parseInt(driver_id) },
    include: { user: true },
  });
  const driverName = driver?.user?.username || 'سائق';

  const notif = await prisma.notifications.create({
    data: {
      type: 'admin',
      message: `🚌 السائق ${driverName} يطلب باص إضافي على خط ${route_name || '—'} — الباص ${bus.plate_number} ممتلئ${note ? ' — ' + note : ''}`,
      sender_type: 'driver',
      sender_id: parseInt(driver_id),
      is_read: false,
    },
  });

  emitNotification('admin', notif);

  return { message: 'تم إرسال الطلب للأدمن' };
};

// ═══════════════════════════════════════════════
// إبلاغ عن عطل — يتسجل بقسم الأعطال فقط (بدون إشعار)
// ═══════════════════════════════════════════════
const reportBreakdown = async ({ driver_id, bus_id, description, station_name }) => {
  const bus = await prisma.buses.findUnique({ where: { bus_id: parseInt(bus_id) } });
  if (!bus) throw { status: 404, message: 'الباص غير موجود' };

  const driver = await prisma.drivers.findUnique({
    where: { driver_id: parseInt(driver_id) },
    include: { user: true },
  });
  if (!driver) throw { status: 404, message: 'السائق غير موجود' };

  await prisma.issues.create({
    data: {
      bus_id: parseInt(bus_id),
      user_id: driver.user_id,
      type: description || 'عطل',
      description: description || 'بدون تفاصيل',
      status: 'pending',
    },
  });

  return { message: 'تم الإبلاغ عن العطل' };
};

// ═══════════════════════════════════════════════
// تسجيل بدء العمل — مع نظام التأكيد للإيقاف
// ═══════════════════════════════════════════════
const logDriverActivity = async (driver_id, bus_id, action) => {
  const now = new Date();
  const driverId = parseInt(driver_id);
  const busId = parseInt(bus_id);

  // سجل النشاط
  await prisma.driver_Activity_Log.create({
    data: { driver_id: driverId, bus_id: busId, action },
  });

  if (action === 'start') {
    // بدء العمل
    const activeShift = await prisma.shifts.findFirst({
      where: {
        driver_id: driverId,
        status: { in: ['scheduled', 'pending_stop', 'paused'] },
      },
      orderBy: { shift_id: 'desc' },
    });

    if (activeShift) {
      await prisma.shifts.update({
        where: { shift_id: activeShift.shift_id },
        data: {
          actual_start: activeShift.actual_start || now,
          status: 'active',
        },
      });
    }

    return { message: 'تم بدء الدوام', pending: false };
  }

  if (action === 'stop') {
    // ← الحل الاحترافي: مو إيقاف مباشر — حالة انتظار تأكيد
    const activeShift = await prisma.shifts.findFirst({
      where: { driver_id: driverId, status: 'active' },
      orderBy: { shift_id: 'desc' },
    });

    if (activeShift) {
      await prisma.shifts.update({
        where: { shift_id: activeShift.shift_id },
        data: { status: 'pending_stop' },
      });

      return {
        message: 'هل أنت متأكد من إنهاء الدوام؟ عندك 30 ثانية للتراجع',
        pending: true,
        shift_id: activeShift.shift_id,
      };
    }

    return { message: 'ما في وردية نشطة', pending: false };
  }

  return { message: 'تم التسجيل', pending: false };
};

// ═══════════════════════════════════════════════
// تأكيد الإيقاف — بعد ما السائق وافق
// ═══════════════════════════════════════════════
const confirmStop = async (driver_id, bus_id) => {
  const now = new Date();
  const driverId = parseInt(driver_id);

  const pendingShift = await prisma.shifts.findFirst({
    where: { driver_id: driverId, status: 'pending_stop' },
    orderBy: { shift_id: 'desc' },
  });

  if (!pendingShift) {
    return { message: 'ما في وردية بانتظار التأكيد' };
  }

  await prisma.shifts.update({
    where: { shift_id: pendingShift.shift_id },
    data: { actual_end: now, status: 'completed' },
  });

  await prisma.driver_Activity_Log.create({
    data: {
      driver_id: driverId,
      bus_id: parseInt(bus_id),
      action: 'confirmed_stop',
    },
  });

  return { message: 'تم إنهاء الدوام بنجاح' };
};

// ═══════════════════════════════════════════════
// إلغاء الإيقاف — السائق تراجع (كبس بالغلط)
// ═══════════════════════════════════════════════
const cancelStop = async (driver_id, bus_id) => {
  const driverId = parseInt(driver_id);

  const pendingShift = await prisma.shifts.findFirst({
    where: { driver_id: driverId, status: 'pending_stop' },
    orderBy: { shift_id: 'desc' },
  });

  if (!pendingShift) {
    return { message: 'ما في شي للتراجع عنو' };
  }

  await prisma.shifts.update({
    where: { shift_id: pendingShift.shift_id },
    data: { status: 'active' },
  });

  await prisma.driver_Activity_Log.create({
    data: {
      driver_id: driverId,
      bus_id: parseInt(bus_id),
      action: 'cancel_stop',
    },
  });

  return { message: 'تم التراجع — أنت لسا بالدوام' };
};

module.exports = {
  updateBusStatus,
  sendDelayAlert,
  requestExtraBus,
  reportBreakdown,
  logDriverActivity,
  confirmStop,
  cancelStop,
};
