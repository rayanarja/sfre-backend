const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const logger = require('./utils/logger');
const { globalLimiter } = require('./middlewares/rateLimiter');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// ═══════════════════ Security ═══════════════════
app.use(helmet());                 // HTTP security headers
app.use(cors());                   // Cross-origin
app.use(globalLimiter);            // Rate limiting — 100 req/min
app.use(express.json({ limit: '10mb' }));

// ═══════════════════ Logging ═══════════════════
app.use(morgan('short', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ═══════════════════ Static ═══════════════════
app.use('/uploads', express.static(require('path').join(__dirname, '../uploads')));

// ═══════════════════ Routes ═══════════════════
app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/users', require('./modules/users/users.routes'));
app.use('/api/buses', require('./modules/buses/buses.routes'));
app.use('/api/routes', require('./modules/routes/routes.routes'));
app.use('/api/stations', require('./modules/stations/stations.routes'));
app.use('/api/tracking', require('./modules/tracking/tracking.routes'));
app.use('/api/subscriptions', require('./modules/subscriptions/subscriptions.routes'));
app.use('/api/subscription-plans', require('./modules/subscription-plans/subscription-plans.routes'));
app.use('/api/trip-history', require('./modules/trip-history/trip-history.routes'));
app.use('/api/notifications', require('./modules/notifications/notifications.routes'));
app.use('/api/reports', require('./modules/reports/reports.routes'));
app.use('/api/lost-items', require('./modules/lost-items/lost-items.routes'));
app.use('/api/drivers', require('./modules/drivers/drivers.routes'));
app.use('/api/issues', require('./modules/issues/issues.routes'));
app.use('/api/shifts', require('./modules/shifts/shifts.routes'));
app.use('/api/driver-actions', require('./modules/driver-actions/driver-actions.routes'));
app.use('/api/bus-tracker', require('./modules/bus-tracker/bus-tracker.routes'));
app.use('/api/pos', require('./modules/pos/pos.routes'));

// ═══════════════════ Swagger Docs ═══════════════════
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bus Management System API',
      version: '2.0.0',
      description: 'API documentation for the bus management system',
    },
    servers: [{ url: '/api' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/docs/*.js'],
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Bus API Docs',
}));

// ═══════════════════ Health Check ═══════════════════
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: '🚌 Bus Management API v2.0',
    docs: '/api/docs',
    timestamp: new Date().toISOString(),
  });
});

// ═══════════════════ Cleanup Job ═══════════════════
setInterval(async () => {
  try {
    const prisma = require('./config/database');
    const today = new Date().toISOString().split('T')[0];
    const result = await prisma.shifts.updateMany({
      where: { status: { in: ['active', 'paused', 'pending_stop'] }, date: { lt: new Date(today) } },
      data: { status: 'completed' },
    });
    if (result.count > 0) logger.info(`Cleanup: ${result.count} shifts completed`);
  } catch (e) {
    logger.error('Cleanup job error:', e.message);
  }
}, 3600000);

// ═══════════════════ Error Handler ═══════════════════
app.use(errorMiddleware);

module.exports = app;
