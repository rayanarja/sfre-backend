const logger = require('../utils/logger');

const errorMiddleware = (err, req, res, next) => {
  const statusCode = err.status || 500;
  let code = 'ERR_5000';

  if (statusCode === 400) code = 'ERR_4000';
  if (statusCode === 401) code = 'ERR_4010';
  if (statusCode === 403) code = 'ERR_4030';
  if (statusCode === 404) code = 'ERR_4040';
  if (statusCode === 409) code = 'ERR_4090';
  if (statusCode === 429) code = 'RATE_001';

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${statusCode}`, {
      code, message: err.message, stack: err.stack, user: req.user?.id,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} → ${statusCode}: ${err.message}`, {
      code, user: req.user?.id,
    });
  }

  res.status(statusCode).json({
    code,
    message: err.message || 'حدث خطأ في السيرفر',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorMiddleware;
