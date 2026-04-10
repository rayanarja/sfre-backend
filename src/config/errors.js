/**
 * نظام أكواد الأخطاء الاحترافي
 * كل خطأ عندو كود فريد — بيسهل الـ debugging والتوثيق
 */
class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.status = statusCode;
    this.isOperational = true;
  }
}

const ErrorCodes = {
  // Auth — 1xxx
  AUTH_INVALID_TOKEN:      new AppError('AUTH_1001', 'التوكن غير صالح أو منتهي', 401),
  AUTH_NO_TOKEN:           new AppError('AUTH_1002', 'يرجى تسجيل الدخول', 401),
  AUTH_FORBIDDEN:          new AppError('AUTH_1003', 'ما عندك صلاحية لهالعملية', 403),
  AUTH_WRONG_CREDENTIALS:  new AppError('AUTH_1004', 'بيانات الدخول غلط', 400),
  AUTH_EMAIL_EXISTS:       new AppError('AUTH_1005', 'الإيميل مستخدم مسبقاً', 400),
  AUTH_USERNAME_EXISTS:    new AppError('AUTH_1006', 'اسم المستخدم مستخدم مسبقاً', 400),
  AUTH_PHONE_EXISTS:       new AppError('AUTH_1007', 'رقم الهاتف مستخدم مسبقاً', 400),
  AUTH_ANOTHER_DEVICE:     new AppError('AUTH_1008', 'تم الدخول من جهاز آخر', 401),

  // Validation — 2xxx
  VALIDATION_ERROR:        new AppError('VAL_2001', 'بيانات غير صحيحة', 400),

  // Resources — 3xxx
  NOT_FOUND:               new AppError('RES_3001', 'غير موجود', 404),
  BUS_NOT_FOUND:           new AppError('RES_3002', 'الباص غير موجود', 404),
  ROUTE_NOT_FOUND:         new AppError('RES_3003', 'الخط غير موجود', 404),
  DRIVER_NOT_FOUND:        new AppError('RES_3004', 'السائق غير موجود', 404),
  USER_NOT_FOUND:          new AppError('RES_3005', 'المستخدم غير موجود', 404),
  PLAN_NOT_FOUND:          new AppError('RES_3006', 'خطة الاشتراك غير موجودة', 404),
  SUBSCRIPTION_NOT_FOUND:  new AppError('RES_3007', 'الاشتراك غير موجود', 404),

  // Business — 4xxx
  SHIFT_CONFLICT:          new AppError('BUS_4001', 'تعارض بالورديات', 400),
  BUS_BUSY:                new AppError('BUS_4002', 'الباص مشغول', 400),
  NO_ACTIVE_SUB:           new AppError('BUS_4003', 'ما عندك اشتراك نشط', 400),
  TRIPS_EXHAUSTED:         new AppError('BUS_4004', 'انتهت رحلاتك', 400),
  INSUFFICIENT_BALANCE:    new AppError('BUS_4005', 'رصيد غير كافي', 400),
  ALREADY_SUBSCRIBED:      new AppError('BUS_4006', 'عندك اشتراك نشط', 400),
  FAMILY_LIMIT:            new AppError('BUS_4007', 'وصلت للحد الأقصى من الأعضاء', 400),

  // Server — 5xxx
  INTERNAL_ERROR:          new AppError('SRV_5001', 'خطأ داخلي بالسيرفر', 500),
  RATE_LIMIT:              new AppError('SRV_5002', 'طلبات كثيرة — حاول بعد شوي', 429),
};

// helper — يرجع خطأ جديد (مو مرجع)
const throwError = (errorCode, customMessage) => {
  const err = { ...errorCode };
  if (customMessage) err.message = customMessage;
  throw err;
};

module.exports = { AppError, ErrorCodes, throwError };
