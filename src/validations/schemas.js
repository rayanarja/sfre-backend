const Joi = require('joi');

// ═══════════════════ Auth ═══════════════════
const register = Joi.object({
  username: Joi.string().min(3).max(50).required().messages({
    'string.min': 'اسم المستخدم لازم 3 أحرف على الأقل',
    'any.required': 'اسم المستخدم مطلوب',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'إيميل غير صحيح',
    'any.required': 'الإيميل مطلوب',
  }),
  password: Joi.string().min(6).max(100).required().messages({
    'string.min': 'كلمة المرور لازم 6 أحرف على الأقل',
    'any.required': 'كلمة المرور مطلوبة',
  }),
  phone: Joi.string().pattern(/^09\d{8}$/).allow(null, '').messages({
    'string.pattern.base': 'رقم الهاتف لازم يكون سوري — مثال: 0912345678',
  }),
  role: Joi.string().valid('admin', 'driver', 'passenger').default('passenger'),
});

const login = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const loginPhone = Joi.object({
  phone: Joi.string().required(),
  password: Joi.string().required(),
});

const changePassword = Joi.object({
  userId: Joi.number().integer(),
  user_id: Joi.number().integer(),
  oldPassword: Joi.string(),
  old_password: Joi.string(),
  newPassword: Joi.string().min(6),
  new_password: Joi.string().min(6),
}).or('oldPassword', 'old_password').or('newPassword', 'new_password');

// ═══════════════════ Routes ═══════════════════
const createRoute = Joi.object({
  route_name: Joi.string().min(2).max(100).required().messages({
    'any.required': 'اسم الخط مطلوب',
  }),
  description: Joi.string().max(500).allow(null, ''),
});

const updateRoute = Joi.object({
  route_name: Joi.string().min(2).max(100),
  description: Joi.string().max(500).allow(null, ''),
}).min(1);

const routeStationItem = Joi.object({
  station_id: Joi.number().integer().required(),
  station_order: Joi.number().integer().min(1).required(),
});

const saveRouteStations = Joi.object({
  outbound: Joi.array().items(routeStationItem).default([]),
  inbound: Joi.array().items(routeStationItem).default([]),
});

// ═══════════════════ Stations ═══════════════════
const createStation = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  lat: Joi.number().min(-90).max(90).allow(null),
  lng: Joi.number().min(-180).max(180).allow(null),
  route_id: Joi.number().integer().positive().required(),
});

const updateStation = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  lat: Joi.number().min(-90).max(90).allow(null),
  lng: Joi.number().min(-180).max(180).allow(null),
  route_id: Joi.number().integer().positive().required(),
});

// ═══════════════════ Buses ═══════════════════
const createBus = Joi.object({
  plate_number: Joi.string().min(2).max(20).required().messages({
    'any.required': 'رقم اللوحة مطلوب',
  }),
  route_id: Joi.number().integer().allow(null),
  direction: Joi.string().valid('outbound', 'inbound').default('outbound'),
  current_station_index: Joi.number().integer().min(0).default(0),
});

const updateBus = Joi.object({
  plate_number: Joi.string().min(2).max(20),
  route_id: Joi.number().integer().allow(null),
  current_status: Joi.string().valid('active', 'inactive', 'maintenance', 'breakdown'),
  current_lat: Joi.number().allow(null),
  current_lng: Joi.number().allow(null),
  direction: Joi.string().valid('outbound', 'inbound').allow(null),
  current_station_index: Joi.number().integer().min(0).allow(null),
});

// ═══════════════════ Drivers ═══════════════════
const createDriver = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required(),
  password: Joi.string().min(6).default('driver123'),
});

// ═══════════════════ Shifts ═══════════════════
const createShift = Joi.object({
  driver_id: Joi.number().integer().required(),
  bus_id: Joi.number().integer().required(),
  shift_type: Joi.string().valid('صباحي', 'مسائي').required(),
  date: Joi.string().required(),
  start_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required().messages({
    'string.pattern.base': 'الوقت لازم يكون بصيغة HH:MM',
  }),
  end_time: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  status: Joi.string().valid('scheduled', 'active', 'paused', 'completed', 'pending_stop'),
});

// ═══════════════════ Subscriptions ═══════════════════
const createSubscription = Joi.object({
  user_id: Joi.number().integer().required(),
  plan_id: Joi.number().integer().required(),
});

const addFamily = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'إيميل غير صحيح',
    'any.required': 'الإيميل مطلوب',
  }),
});

// ═══════════════════ Reports ═══════════════════
const createReport = Joi.object({
  user_id: Joi.number().integer().required(),
  bus_id: Joi.number().integer().required(),
  type: Joi.string().valid('complaint', 'suggestion', 'incident').required(),
  description: Joi.string().min(5).max(1000).required(),
});

// ═══════════════════ Notifications ═══════════════════
const createNotification = Joi.object({
  recipient_id: Joi.number().integer().allow(null),
  type: Joi.string().valid('admin', 'driver', 'passenger', 'general').default('general'),
  message: Joi.string().min(1).max(500).required(),
  sender_type: Joi.string().valid('admin', 'driver', 'system').default('admin'),
  sender_id: Joi.number().integer().allow(null),
});

// ═══════════════════ Driver Actions ═══════════════════
const logActivity = Joi.object({
  driver_id: Joi.number().integer().required(),
  bus_id: Joi.number().integer().required(),
  action: Joi.string().valid('start', 'stop').required(),
});

const delayAlert = Joi.object({
  driver_id: Joi.number().integer().required(),
  bus_id: Joi.number().integer().required(),
  station_name: Joi.string().allow(null, ''),
  reason: Joi.string().max(200).allow(null, ''),
});

const requestBus = Joi.object({
  driver_id: Joi.number().integer().required(),
  bus_id: Joi.number().integer().required(),
  route_name: Joi.string().allow(null, ''),
  note: Joi.string().max(200).allow(null, ''),
});

const reportBreakdown = Joi.object({
  driver_id: Joi.number().integer().required(),
  bus_id: Joi.number().integer().required(),
  description: Joi.string().max(500).allow(null, ''),
  station_name: Joi.string().allow(null, ''),
});

const confirmStop = Joi.object({
  driver_id: Joi.number().integer().required(),
  bus_id: Joi.number().integer().required(),
});

// ═══════════════════ POS ═══════════════════
const createPOS = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  owner_name: Joi.string().min(2).max(100).required(),
  phone: Joi.string().required(),
  email: Joi.string().email().allow(null, ''),
  password: Joi.string().min(6).required(),
  lat: Joi.number().allow(null),
  lng: Joi.number().allow(null),
});

const sellSubscription = Joi.object({
  pos_id: Joi.number().integer().required(),
  user_email: Joi.string().email().required(),
  plan_id: Joi.number().integer().required(),
});

const rechargeBalance = Joi.object({
  amount: Joi.number().positive().required().messages({
    'number.positive': 'المبلغ لازم يكون أكبر من صفر',
  }),
});

// ═══════════════════ Lost Items ═══════════════════
const createLostItem = Joi.object({
  bus_id: Joi.number().integer().required(),
  reporter_id: Joi.number().integer().required(),
  reporter_type: Joi.string().valid('passenger', 'driver').required(),
  description: Joi.string().min(5).max(500).required(),
  found_location: Joi.string().allow(null, ''),
});

// ═══════════════════ Trip History ═══════════════════
const boardBus = Joi.object({
  user_id: Joi.number().integer().required(),
  bus_id: Joi.number().integer().required(),
  route_name: Joi.string().allow(null, ''),
  from_station: Joi.string().allow(null, ''),
});

// ═══════════════════ Subscription Plans ═══════════════════
const createPlan = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  trip_limit: Joi.number().integer().min(1).required(),
  price: Joi.number().positive().required(),
  max_users: Joi.number().integer().min(1).default(1),
  duration_days: Joi.number().integer().min(1).default(30),
  description: Joi.string().max(200).allow(null, ''),
});

// ═══════════════════ Bus Tracker ═══════════════════
const updatePosition = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

module.exports = {
  auth: { register, login, loginPhone, changePassword },
  routes: { createRoute, updateRoute, saveRouteStations },
  stations: { createStation, updateStation },
  buses: { createBus, updateBus },
  drivers: { createDriver },
  shifts: { createShift },
  subscriptions: { createSubscription, addFamily },
  reports: { createReport },
  notifications: { createNotification },
  driverActions: { logActivity, delayAlert, requestBus, reportBreakdown, confirmStop },
  pos: { createPOS, sellSubscription, rechargeBalance },
  lostItems: { createLostItem },
  tripHistory: { boardBus },
  plans: { createPlan },
  busTracker: { updatePosition },
};
