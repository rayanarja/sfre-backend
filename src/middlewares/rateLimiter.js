const rateLimit = require('express-rate-limit');

// عام — 500 طلب بالدقيقة (الداشبورد بيبعث كتير)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_001', message: 'طلبات كثيرة — انتظر شوي' },
});

// تسجيل الدخول — 15 محاولة بـ 15 دقيقة
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_002', message: 'محاولات كثيرة — انتظر 15 دقيقة' },
});

// APIs الثقيلة — 60 طلب بالدقيقة
const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_003', message: 'طلبات كثيرة — خفف شوي' },
});

module.exports = { globalLimiter, authLimiter, heavyLimiter };
