const prisma = require('../../config/database');
const path = require('path');
const fs = require('fs');

const getAllLostItems = async () => {
  return await prisma.lost_Items.findMany({
    include: { bus: true, reporter: true },
    orderBy: { report_date: 'desc' },
  });
};

const getLostItemById = async (id) => {
  const item = await prisma.lost_Items.findUnique({
    where: { item_id: parseInt(id) },
    include: { bus: true, reporter: true },
  });
  if (!item) throw { status: 404, message: 'الغرض غير موجود' };
  return item;
};

const createLostItem = async (data, imageFile) => {
  let image_url = null;

  if (imageFile) {
    const uploadsDir = path.join(__dirname, '../../../uploads/lost-items');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const fileName = `${Date.now()}-${imageFile.originalname}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), imageFile.buffer);
    image_url = `/uploads/lost-items/${fileName}`;
  }

  const isDriver = data.reporter_type === 'driver';

  const item = await prisma.lost_Items.create({
    data: {
      bus_id: parseInt(data.bus_id),
      reporter_id: parseInt(data.reporter_id),
      reporter_type: data.reporter_type,
      description: data.description,
      found_location: data.found_location || null,
      status: isDriver ? 'found' : 'lost',
      image_url,
    },
    include: { bus: true },
  });

  // المفقودات بتطلع بقسم المفقودات — ما بتنزل بالإشعارات
  // بس بتحديث الـ badge بالسايدبار (لأنو الداشبورد بيعمل polling)

  return item;
};

const updateLostItem = async (id, data) => {
  return await prisma.lost_Items.update({ where: { item_id: parseInt(id) }, data });
};

const updateLostItemStatus = async (id, status) => {
  const item = await prisma.lost_Items.update({
    where: { item_id: parseInt(id) },
    data: { status },
    include: { reporter: true },
  });

  const statusAr = status === 'found' ? 'تم إيجاده'
                 : status === 'returned' ? 'تم إرجاعه'
                 : status === 'pending' ? 'قيد البحث'
                 : 'مفقود';

  // إشعار للمُبلِّغ لما الأدمن يغير الحالة
  if (item.reporter_id) {
    await prisma.notifications.create({
      data: {
        type: 'personal',
        recipient_id: item.reporter_id,
        message: `🎒 تحديث بلاغ مفقوداتك: ${statusAr}`,
        sender_type: 'admin',
        sender_id: null,
        is_read: false,
      },
    });
  }

  return item;
};

const deleteLostItem = async (id) => {
  return await prisma.lost_Items.delete({ where: { item_id: parseInt(id) } });
};

module.exports = {
  getAllLostItems, getLostItemById, createLostItem,
  updateLostItem, updateLostItemStatus, deleteLostItem,
};
