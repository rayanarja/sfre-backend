const prisma = require('../../config/database');
const { emitNotification } = require('../../socket');

const getAllNotifications = async () => {
  return await prisma.notifications.findMany({
    orderBy: { created_at: 'desc' },
  });
};

/**
 * جلب إشعارات المستخدم حسب دوره
 * admin → يشوف: admin + passenger + general
 * driver → يشوف: driver + general + يلي recipient_id = هو
 * passenger → يشوف: passenger + general + يلي recipient_id = هو
 */
const getUserNotifications = async (user_id, role) => {
  const userId = parseInt(user_id);
  
  let typeFilter = ['general'];
  
  if (role === 'admin') {
    typeFilter = ['admin', 'passenger', 'general', 'driver'];
  } else if (role === 'driver') {
    typeFilter = ['driver', 'general'];
  } else if (role === 'passenger') {
    typeFilter = ['passenger', 'general'];
  }

  return await prisma.notifications.findMany({
    where: {
      OR: [
        { type: { in: typeFilter } },
        { recipient_id: userId },
      ],
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  });
};

const createNotification = async (data) => {
  const notification = await prisma.notifications.create({
    data: {
      recipient_id: data.recipient_id ? parseInt(data.recipient_id) : null,
      type: data.type || 'general',
      message: data.message,
      sender_type: data.sender_type || 'admin',
      sender_id: data.sender_id ? parseInt(data.sender_id) : null,
    },
  });

  // ← Real-time: أبعث الإشعار فوراً
  emitNotification(notification.type, notification);

  return notification;
};

const markAsRead = async (id) => {
  return await prisma.notifications.update({
    where: { notification_id: parseInt(id) },
    data: { is_read: true },
  });
};

const deleteNotification = async (id) => {
  return await prisma.notifications.delete({
    where: { notification_id: parseInt(id) },
  });
};

module.exports = {
  getAllNotifications,
  getUserNotifications,
  createNotification,
  markAsRead,
  deleteNotification,
};
