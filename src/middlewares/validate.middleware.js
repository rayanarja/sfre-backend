/**
 * Validation Middleware — يستخدم Joi
 * بيفحص body / query / params حسب الحاجة
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
    const { error, value } = schema.validate(data, {
      abortEarly: false,    // يعرض كل الأخطاء مو بس الأولى
      stripUnknown: true,   // يشيل الحقول الزيادة
      allowUnknown: false,
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message,
      }));

      return res.status(400).json({
        code: 'VAL_2001',
        message: 'بيانات غير صحيحة',
        details,
      });
    }

    // حط القيم المنظفة
    if (source === 'body') req.body = value;
    else if (source === 'query') req.query = value;
    else req.params = value;

    next();
  };
};

module.exports = validate;
