const prisma = require('../../config/database');

const getAllUsers = async () => {
  return await prisma.users.findMany({
    select: {
      user_id: true, username: true, email: true, phone: true,
      role: true, language: true, theme: true, registration_date: true,
    },
    orderBy: { user_id: 'desc' },
  });
};

const getUserById = async (id) => {
  const user = await prisma.users.findUnique({
    where: { user_id: parseInt(id) },
    select: {
      user_id: true, username: true, email: true, phone: true,
      role: true, language: true, theme: true, registration_date: true,
    },
  });
  if (!user) throw { status: 404, message: 'المستخدم غير موجود' };
  return user;
};

const updateUser = async (id, data) => {
  const allowed = {};
  if (data.username) allowed.username = data.username;
  if (data.email) allowed.email = data.email;
  if (data.phone) allowed.phone = data.phone;
  if (data.language) allowed.language = data.language;
  if (data.theme) allowed.theme = data.theme;
  return await prisma.users.update({
    where: { user_id: parseInt(id) },
    data: allowed,
    select: { user_id: true, username: true, email: true, phone: true, role: true, language: true, theme: true },
  });
};

const deleteUser = async (id) => {
  return await prisma.users.delete({ where: { user_id: parseInt(id) } });
};

module.exports = { getAllUsers, getUserById, updateUser, deleteUser };
