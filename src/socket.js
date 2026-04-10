const { Server } = require('socket.io');
const logger = require('./utils/logger');

let io = null;

/**
 * ═══════════════════════════════════════════════
 * Socket.IO — Real-time Bus Tracking & Notifications
 * 
 * Rooms:
 *   bus:{bus_id}     — الركاب يلي عم يتابعوا باص معين
 *   route:{route_id} — الركاب يلي على خط معين
 *   driver:{driver_id} — السائق
 *   admin            — كل الأدمنز
 *   passengers       — كل الركاب
 * 
 * Events (Server → Client):
 *   bus:position     — موقع الباص تحدث (lat, lng, station, speed)
 *   bus:status       — حالة الباص تغيرت (active, inactive, breakdown)
 *   notification     — إشعار جديد
 *   shift:update     — وردية تحدثت
 * 
 * Events (Client → Server):
 *   bus:track         — الراكب بيتابع باص { bus_id }
 *   bus:untrack       — الراكب وقف المتابعة
 *   position:update   — السائق يبعث موقعه { bus_id, lat, lng }
 * ═══════════════════════════════════════════════
 */

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // المستخدم يعرّف عن حالو
    socket.on('join', (data) => {
      if (data.role === 'admin') {
        socket.join('admin');
        logger.debug(`Admin joined: ${socket.id}`);
      }
      if (data.role === 'driver' && data.driver_id) {
        socket.join(`driver:${data.driver_id}`);
        logger.debug(`Driver ${data.driver_id} joined: ${socket.id}`);
      }
      if (data.role === 'passenger') {
        socket.join('passengers');
      }
      if (data.user_id) {
        socket.join(`user:${data.user_id}`);
      }
    });

    // راكب يتابع باص
    socket.on('bus:track', (data) => {
      if (data.bus_id) {
        socket.join(`bus:${data.bus_id}`);
        logger.debug(`Socket ${socket.id} tracking bus ${data.bus_id}`);
      }
      if (data.route_id) {
        socket.join(`route:${data.route_id}`);
      }
    });

    // راكب وقف المتابعة
    socket.on('bus:untrack', (data) => {
      if (data.bus_id) socket.leave(`bus:${data.bus_id}`);
      if (data.route_id) socket.leave(`route:${data.route_id}`);
    });

    // السائق يبعث موقعه — يتوزع لكل يلي عم يتابعوا
    socket.on('position:update', (data) => {
      if (data.bus_id && data.lat && data.lng) {
        io.to(`bus:${data.bus_id}`).emit('bus:position', {
          bus_id: data.bus_id,
          lat: data.lat,
          lng: data.lng,
          speed: data.speed || 0,
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info('🔌 Socket.IO initialized');
  return io;
};

/**
 * Helper functions — تُستخدم من الـ services
 */

// بعث تحديث موقع باص لكل يلي عم يتابعوا
const emitBusPosition = (bus_id, data) => {
  if (!io) return;
  io.to(`bus:${bus_id}`).emit('bus:position', {
    bus_id,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

// بعث تغيير حالة باص
const emitBusStatus = (bus_id, status) => {
  if (!io) return;
  io.to(`bus:${bus_id}`).emit('bus:status', { bus_id, status });
  io.to('admin').emit('bus:status', { bus_id, status });
};

// بعث إشعار حسب النوع
const emitNotification = (type, notification) => {
  if (!io) return;
  if (type === 'admin') {
    io.to('admin').emit('notification', notification);
  } else if (type === 'passenger') {
    io.to('passengers').emit('notification', notification);
  } else if (type === 'general') {
    io.emit('notification', notification);
  }
  // إشعار لمستخدم محدد
  if (notification.recipient_id) {
    io.to(`user:${notification.recipient_id}`).emit('notification', notification);
  }
};

// بعث تحديث وردية
const emitShiftUpdate = (driver_id, shift) => {
  if (!io) return;
  io.to(`driver:${driver_id}`).emit('shift:update', shift);
  io.to('admin').emit('shift:update', shift);
};

const getIO = () => io;

module.exports = {
  initSocket,
  getIO,
  emitBusPosition,
  emitBusStatus,
  emitNotification,
  emitShiftUpdate,
};
