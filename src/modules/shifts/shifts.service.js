const prisma = require('../../config/database');

const getAllShifts = async () => {
  return await prisma.shifts.findMany({
    include: { driver: { include: { user: true } }, bus: true }
  });
};

const getShiftsByDriver = async (driver_id) => {
  return await prisma.shifts.findMany({
    where: { driver_id: parseInt(driver_id) },
    include: { bus: true },
    orderBy: { date: 'desc' }
  });
};

const createShift = async (data) => {
  const allShifts = await prisma.shifts.findMany({
    where: {
      driver_id: parseInt(data.driver_id),
      date: {
        gte: new Date(new Date(data.date).setHours(0, 0, 0, 0)),
        lte: new Date(new Date(data.date).setHours(23, 59, 59, 999)),
      },
      status: { in: ['scheduled', 'active'] }
    }
  });

  // تحقق من تعارض الأوقات
  const newStart = data.start_time;
  const newEnd   = data.end_time;

  const conflict = allShifts.find(s => {
    return newStart < s.end_time && newEnd > s.start_time;
  });

  if (conflict) {
    throw {
      status: 400,
      message: `تعارض! السائق عنده وردية ${conflict.shift_type} من ${conflict.start_time} إلى ${conflict.end_time}`
    };
  }
  // تحقق إنو الباص مو مشغول بنفس الوقت
  const busConflict = await prisma.shifts.findFirst({
    where: {
      bus_id: parseInt(data.bus_id),
      date: {
        gte: new Date(new Date(data.date).setHours(0, 0, 0, 0)),
        lte: new Date(new Date(data.date).setHours(23, 59, 59, 999)),
      },
      status: { in: ['scheduled', 'active'] },
      start_time: { lt: data.end_time },
      end_time: { gt: data.start_time },
    },
    include: { driver: { include: { user: true } } },
  });

  if (busConflict) {
    throw {
      status: 400,
      message: `الباص مشغول! عندو وردية مع ${busConflict.driver?.user?.username || 'سائق'} من ${busConflict.start_time} إلى ${busConflict.end_time}`
    };
  }

  return await prisma.shifts.create({
    data: {
      driver_id:  parseInt(data.driver_id),
      bus_id:     parseInt(data.bus_id),
      shift_type: data.shift_type,
      start_time: data.start_time,
      end_time:   data.end_time,
      status:     data.status || 'scheduled',
      date:       data.date ? new Date(data.date) : new Date(),
    },
    include: { driver: { include: { user: true } }, bus: true }
  });
};

const updateShift = async (id, data) => {
  return await prisma.shifts.update({
    where: { shift_id: parseInt(id) },
    data,
    include: { driver: { include: { user: true } }, bus: true }
  });
};

const deleteShift = async (id) => {
  return await prisma.shifts.delete({ where: { shift_id: parseInt(id) } });
};

module.exports = { getAllShifts, getShiftsByDriver, createShift, updateShift, deleteShift };