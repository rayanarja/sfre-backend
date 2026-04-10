const jwt = require('jsonwebtoken');
const prisma = require('../config/database');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'لا يوجد توكن، يرجى تسجيل الدخول' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
// تحقق إنو التوكن هو النشط (منع دخول بأكثر من جهاز) — بس للمستخدمين العاديين
    if (decoded.role !== 'pos') {
      const user = await prisma.users.findUnique({
        where: { user_id: decoded.id },
        select: { active_token: true },
      });

      if (user && user.active_token && user.active_token !== token) {
        return res.status(401).json({ message: 'تم تسجيل الدخول من جهاز آخر — سجل دخول مرة ثانية' });
      }
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'التوكن غير صالح أو منتهي الصلاحية' });
  }
};

module.exports = authMiddleware;