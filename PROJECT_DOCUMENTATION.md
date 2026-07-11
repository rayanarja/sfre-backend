# توثيق مشروع BUS-BACKEND

> هذا الملف يشرح بنية قاعدة البيانات، خوارزميات المشروع، آلية الطلبات والبحث عن خط، سير العمل لكل نوع مستخدم، تدفق البيانات، الميزات، والأدوات المستخدمة في المشروع.

## 1. نظرة عامة

`BUS-BACKEND` هو Backend لإدارة منظومة نقل بالباصات. المشروع مبني على `Node.js` و`Express`، ويستخدم `Prisma ORM` مع قاعدة بيانات `MySQL`. يدعم المشروع:

- إدارة المستخدمين بثلاثة أدوار رئيسية: `admin`, `driver`, `passenger`.
- إدارة الباصات والخطوط والمواقف.
- تتبع موقع الباصات لحظياً عبر `Socket.IO`.
- البحث الذكي عن الوجهة وتخطيط الرحلة.
- الاشتراكات الفردية والعائلية.
- التحقق من ركوب الباص عبر QR.
- إدارة البلاغات، الأعطال، المفقودات، الإشعارات، الورديات، ونقاط البيع POS.

نقطة تشغيل السيرفر الأساسية هي `server.js`، والتطبيق الرئيسي موجود في `src/app.js`.

## 2. بنية المشروع

```text
BUS-BACKEND/
├─ server.js
├─ seed.js
├─ package.json
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ src/
│  ├─ app.js
│  ├─ socket.js
│  ├─ config/
│  ├─ docs/
│  ├─ middlewares/
│  ├─ modules/
│  │  ├─ auth/
│  │  ├─ users/
│  │  ├─ buses/
│  │  ├─ routes/
│  │  ├─ stations/
│  │  ├─ tracking/
│  │  ├─ bus-tracker/
│  │  ├─ subscriptions/
│  │  ├─ subscription-plans/
│  │  ├─ trip-history/
│  │  ├─ notifications/
│  │  ├─ reports/
│  │  ├─ lost-items/
│  │  ├─ drivers/
│  │  ├─ issues/
│  │  ├─ shifts/
│  │  ├─ driver-actions/
│  │  └─ pos/
│  ├─ utils/
│  └─ validations/
├─ uploads/
└─ logs/
```

كل Module غالباً يحتوي على:

- `*.routes.js`: تعريف المسارات.
- `*.controller.js`: استقبال الطلب وتجهيز الاستجابة.
- `*.service.js`: منطق العمل والتعامل مع قاعدة البيانات.

## 3. أدوات وتقنيات المشروع

| الأداة | الاستخدام |
|---|---|
| Node.js | تشغيل الخادم |
| Express 5 | بناء REST API |
| Prisma Client | ORM للتعامل مع MySQL |
| MySQL | قاعدة البيانات |
| Socket.IO | التحديث اللحظي لمواقع الباصات والإشعارات |
| JWT | المصادقة بالتوكن |
| bcryptjs | تشفير كلمات المرور |
| Joi | التحقق من بيانات الطلبات |
| Helmet | تحسين أمان HTTP headers |
| CORS | السماح بالوصول من تطبيقات خارجية |
| express-rate-limit | تحديد عدد الطلبات |
| Morgan + Winston | تسجيل logs |
| Multer | رفع صور المفقودات |
| Swagger UI | توثيق API على `/api/docs` |
| OpenStreetMap Nominatim | البحث الجغرافي عن المناطق بدون API key |

## 4. بنية قاعدة البيانات

قاعدة البيانات معرفة في `prisma/schema.prisma` وتستخدم `MySQL`.

### 4.1 المستخدمون والصلاحيات

#### `Users`
يمثل كل مستخدمي النظام.

أهم الحقول:

- `user_id`: المفتاح الأساسي.
- `username`: اسم مستخدم فريد.
- `email`: بريد فريد.
- `password`: كلمة مرور مشفرة.
- `phone`: رقم الهاتف.
- `role`: الدور، قيمته من `UserRole`.
- `language`, `theme`: إعدادات الواجهة.
- `must_change_password`: إجبار المستخدم على تغيير كلمة المرور.
- `active_token`: التوكن النشط لمنع تعدد الجلسات للمستخدمين العاديين.

العلاقات:

- المستخدم قد يكون لديه `Subscriptions`.
- المستخدم قد يكون `Driver` واحداً.
- المستخدم يملك `Reports`, `Issues`, `Lost_Items`, `Trip_History`.
- قد يكون عضواً ضمن `Family_Members`.

#### `UserRole`

```text
admin
driver
passenger
```

#### `Drivers`
يمثل بيانات السائق المرتبطة بحساب مستخدم.

أهم الحقول:

- `driver_id`
- `user_id`: علاقة فريدة مع `Users`.
- `shift_time`
- `status`: `online` أو `offline`.

العلاقات:

- السائق لديه ورديات `Shifts`.
- السائق لديه سجل نشاط `Driver_Activity_Log`.

### 4.2 الباصات والخطوط والمواقف

#### `Buses`
يمثل الباصات.

أهم الحقول:

- `bus_id`
- `plate_number`: رقم اللوحة، فريد.
- `route_id`: الخط الحالي.
- `current_status`: حالة الباص.
- `current_lat`, `current_lng`: آخر موقع معروف.
- `last_update`: آخر تحديث للموقع.
- `direction`: `outbound` أو `inbound`.
- `current_station_index`: ترتيب أقرب موقف/موقع على الخط.

#### `BusStatus`

```text
active
inactive
maintenance
breakdown
```

#### `Routes`
يمثل الخطوط.

أهم الحقول:

- `route_id`
- `route_name`
- `description`
- `pair_route_id`: يربط خط الذهاب بخط الإياب والعكس.

فكرة `pair_route_id` مهمة جداً: بدلاً من الاعتماد على اسم الخط لمعرفة الاتجاه المعاكس، يتم ربط خطين ببعضهما بشكل صريح.

#### `Stations`
يمثل مواقف الخط.

أهم الحقول:

- `station_id`
- `route_id`
- `name`
- `lat`, `lng`
- `order_index`: ترتيب الموقف على الخط.

#### `Bus_Tracking_Log`
يحفظ سجل مواقع الباصات.

أهم الحقول:

- `bus_id`
- `station_id`
- `lat`, `lng`
- `speed`
- `timestamp`

### 4.3 الاشتراكات

#### `Subscription_Plans`
يمثل خطط الاشتراك.

أهم الحقول:

- `name`
- `trip_limit`: عدد الرحلات.
- `price`
- `max_users`: عدد المستخدمين المسموح بهم في الاشتراك.
- `duration_days`: مدة الاشتراك.
- `is_active`

#### `Subscriptions`
يمثل اشتراك مستخدم.

أهم الحقول:

- `user_id`
- `plan_id`
- `start_date`, `end_date`
- `trips_used`
- `trips_limit`
- `max_users`
- `status`: `active`, `expired`, `cancelled`.

#### `Family_Members`
يربط مستخدمين إضافيين باشتراك عائلي.

- يوجد قيد فريد على `(subscription_id, user_id)` لمنع التكرار.

### 4.4 العمليات التشغيلية

#### `Shifts`
يمثل ورديات السائقين.

أهم الحقول:

- `driver_id`
- `bus_id`
- `shift_type`
- `date`
- `start_time`, `end_time`
- `status`: `scheduled`, `active`, `paused`, `pending_stop`, `completed`.
- `actual_start`, `actual_end`

#### `Trip_History`
يمثل سجل ركوب ونزول الركاب.

أهم الحقول:

- `user_id`
- `bus_id`
- `route_name`
- `from_station`, `to_station`
- `boarded_at`, `exited_at`

#### `Driver_Activity_Log`
يسجل أفعال السائق مثل بدء الدوام، طلب الإيقاف، تأكيد الإيقاف، إلغاء الإيقاف.

### 4.5 البلاغات والإشعارات والمفقودات

#### `Notifications`
يحفظ الإشعارات.

أهم الحقول:

- `recipient_id`: اختياري لإشعار مستخدم محدد.
- `type`: مثل `general`, `admin`, `passenger`, `personal`.
- `message`
- `sender_type`, `sender_id`
- `is_read`

#### `Reports`
بلاغات الركاب مثل شكوى أو اقتراح أو حادث.

#### `Issues`
أعطال أو مشاكل مرتبطة بباص ومستخدم.

#### `Lost_Items`
بلاغات المفقودات مع إمكانية رفع صورة.

### 4.6 نقاط البيع POS

#### `POS_Points`
يمثل نقطة بيع اشتراكات.

أهم الحقول:

- `name`, `owner_name`, `phone`, `email`
- `password`
- `lat`, `lng`
- `balance`
- `is_active`
- `must_change_password`

#### `POS_Transactions`
يسجل عمليات نقطة البيع:

- شحن رصيد `recharge`.
- بيع اشتراك `sale`.

## 5. المصادقة والصلاحيات

### 5.1 تسجيل مستخدم

المسار:

```http
POST /api/auth/register
```

الآلية:

1. التحقق من أن البريد غير مستخدم.
2. التحقق من أن اسم المستخدم غير مستخدم.
3. تشفير كلمة المرور باستخدام `bcrypt`.
4. إنشاء مستخدم جديد بالدور المحدد.

### 5.2 تسجيل الدخول بالبريد

```http
POST /api/auth/login
```

الآلية:

1. البحث عن المستخدم بالبريد.
2. مقارنة كلمة المرور مع النسخة المشفرة.
3. إنشاء JWT يحتوي: `id`, `email`, `role`.
4. مدة التوكن 7 أيام.

### 5.3 تسجيل دخول السائق بالهاتف

```http
POST /api/auth/login-phone
```

الآلية:

1. تطبيع رقم الهاتف السوري، مثل تحويل `+963` أو `00963` إلى صيغة تبدأ بـ `0`.
2. البحث عن مستخدم بهذا الهاتف.
3. التأكد أن الدور هو `driver`.
4. إرجاع بيانات السائق وآخر الورديات.

### 5.4 Middleware المصادقة

أي طلب محمي يمر عبر `auth.middleware.js`:

1. يقرأ `Authorization: Bearer <token>`.
2. يتحقق من JWT باستخدام `JWT_SECRET`.
3. إذا لم يكن الدور `pos`، يتحقق من `active_token` لمنع تسجيل الدخول من أكثر من جهاز عند تفعيل هذه السياسة.
4. يضع بيانات المستخدم في `req.user`.

### 5.5 Middleware الصلاحيات

`role.middleware.js` يستخدم بالشكل:

```js
authorize('admin')
authorize('admin', 'driver')
```

ويرفض الطلب إذا لم يكن دور المستخدم ضمن الأدوار المطلوبة.

## 6. واجهات API الرئيسية

### 6.1 Auth

| Method | Endpoint | الوصف |
|---|---|---|
| POST | `/api/auth/register` | تسجيل مستخدم |
| POST | `/api/auth/login` | تسجيل دخول بالبريد |
| POST | `/api/auth/login-phone` | تسجيل دخول سائق بالهاتف |
| POST | `/api/auth/change-password` | تغيير كلمة المرور |

### 6.2 Users

| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/users` | جلب المستخدمين، للأدمن |
| GET | `/api/users/:id` | جلب مستخدم |
| PUT | `/api/users/:id` | تعديل مستخدم |
| DELETE | `/api/users/:id` | حذف مستخدم، للأدمن |

### 6.3 Routes and Stations

| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/routes` | كل الخطوط مع المواقف والباصات |
| GET | `/api/routes/:id` | خط محدد |
| POST | `/api/routes` | إنشاء خط، للأدمن |
| PUT | `/api/routes/:id` | تعديل خط، للأدمن |
| DELETE | `/api/routes/:id` | حذف خط، للأدمن |
| POST | `/api/routes/link` | ربط خطين ذهاب/إياب |
| DELETE | `/api/routes/:id/unlink` | فك ربط خط |
| GET | `/api/stations` | كل المواقف |
| GET | `/api/stations/search` | البحث عن وجهة |
| GET | `/api/stations/smart-search` | بحث ذكي |
| GET | `/api/stations/plan-route` | تخطيط رحلة باسم محطة |
| GET | `/api/stations/plan-route-v2` | تخطيط رحلة بمحطة أو منطقة أو إحداثيات |
| GET | `/api/stations/suggestions` | اقتراحات مواقف |
| GET | `/api/stations/hybrid-suggestions` | اقتراحات مواقف ومناطق |

### 6.4 Buses and Tracking

| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/buses` | كل الباصات |
| GET | `/api/buses/:id` | باص محدد |
| POST | `/api/buses` | إنشاء باص، للأدمن |
| PUT | `/api/buses/:id` | تعديل باص، للأدمن أو السائق |
| DELETE | `/api/buses/:id` | حذف باص، للأدمن |
| GET | `/api/buses/nearby` | باصات قريبة من موقف |
| GET | `/api/buses/:id/qr` | إنشاء بيانات QR للباص |
| POST | `/api/buses/verify-qr` | التحقق من QR وخصم رحلة |
| GET | `/api/tracking` | سجل التتبع |
| GET | `/api/tracking/:bus_id` | سجل تتبع باص |
| POST | `/api/tracking` | إنشاء سجل تتبع |
| PUT | `/api/bus-tracker/position/:bus_id` | تحديث موقع الباص |
| GET | `/api/bus-tracker/map` | الباصات الظاهرة على الخريطة |
| GET | `/api/bus-tracker/find-buses` | البحث عن باص مناسب للراكب |
| GET | `/api/bus-tracker/stations/:route_id` | مواقف خط محدد |

### 6.5 Subscriptions and POS

| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/subscription-plans` | عرض الخطط |
| POST | `/api/subscription-plans` | إنشاء خطة، للأدمن |
| GET | `/api/subscriptions/user/:user_id` | اشتراك مستخدم |
| POST | `/api/subscriptions` | إنشاء اشتراك |
| POST | `/api/subscriptions/use-trip/:user_id` | خصم رحلة |
| POST | `/api/subscriptions/:id/family` | إضافة عضو عائلي |
| DELETE | `/api/subscriptions/family/:member_id` | حذف عضو عائلي |
| PUT | `/api/subscriptions/:id/cancel` | إلغاء اشتراك |
| POST | `/api/pos/login` | تسجيل دخول نقطة بيع |
| POST | `/api/pos/sell` | بيع اشتراك |
| POST | `/api/pos/:id/recharge` | شحن رصيد نقطة بيع، للأدمن |
| GET | `/api/pos/active` | نقاط البيع النشطة للراكب |
| GET | `/api/pos/transactions/:id` | معاملات نقطة بيع |

### 6.6 Driver Actions and Shifts

| Method | Endpoint | الوصف |
|---|---|---|
| GET | `/api/shifts` | كل الورديات |
| GET | `/api/shifts/driver/:driver_id` | ورديات سائق |
| POST | `/api/shifts` | إنشاء وردية، للأدمن |
| PUT | `/api/driver-actions/bus-status/:bus_id` | تحديث حالة باص |
| POST | `/api/driver-actions/delay-alert` | إرسال تنبيه تأخير |
| POST | `/api/driver-actions/request-bus` | طلب باص إضافي |
| POST | `/api/driver-actions/report-breakdown` | بلاغ عطل |
| POST | `/api/driver-actions/log-activity` | تسجيل نشاط سائق |
| POST | `/api/driver-actions/confirm-stop` | تأكيد إنهاء الدوام |
| POST | `/api/driver-actions/cancel-stop` | إلغاء إنهاء الدوام |

## 7. خوارزميات المشروع

### 7.1 حساب المسافة Haversine

الملف: `src/utils/geo.js`

تستخدم دالة `getDistance(lat1, lon1, lat2, lon2)` قانون Haversine لحساب المسافة بين نقطتين على سطح الأرض بالمتر.

الاستخدامات:

- إيجاد أقرب موقف للراكب.
- إيجاد أقرب موقف للوجهة.
- حساب المسافة بين الباص والموقف.
- حساب مسافة المشي في تخطيط الرحلة.
- حساب المسافة بين موقفي تحويل.

### 7.2 إيجاد أقرب موقف للباص

عند تحديث موقع الباص عبر:

```http
PUT /api/bus-tracker/position/:bus_id
```

تعمل الخدمة `updateBusPosition` بالشكل التالي:

1. جلب الباص مع الخط الحالي ومواقفه مرتبة حسب `order_index`.
2. المرور على كل مواقف الخط.
3. حساب المسافة بين إحداثيات الباص وكل موقف.
4. اختيار الموقف صاحب أقل مسافة.
5. تحديث حقول الباص:
   - `current_lat`
   - `current_lng`
   - `current_station_index`
   - `direction`
   - `last_update`
6. إذا أصبح الباص قريباً من آخر موقف بأقل من 200 متر، يتم تبديله للخط المعاكس.
7. إرسال الموقع لحظياً للمشتركين عبر Socket.IO.

### 7.3 تبديل الباص إلى الخط المعاكس

الدالة: `switchToOppositeRoute`

المنطق:

1. إذا كان للخط الحالي `pair_route_id`، يتم جلب الخط المعاكس منه.
2. إذا لم يوجد، يستخدم النظام fallback بالاسم، مثل استبدال كلمة ذهاب بإياب أو العكس.
3. عند إيجاد الخط المعاكس يتم تحديث الباص:
   - `route_id` إلى الخط الجديد.
   - `current_station_index = 0`.
   - `direction` حسب اسم الخط.

الأفضلية دائماً لاستخدام `pair_route_id` لأنه أدق من الاعتماد على النص.

### 7.4 البحث عن باص مناسب للراكب

المسار:

```http
GET /api/bus-tracker/find-buses
```

الخدمة: `findBusesForPassenger(route_id, passenger_station_index, destination_station_index)`

المنطق:

1. تحديد اتجاه الراكب:
   - إذا كان `destination_station_index > passenger_station_index` فالجهة `outbound`.
   - غير ذلك فالجهة `inbound`.
2. جلب الخط الحالي، وإضافة `pair_route_id` إن وجد لقائمة الخطوط المحتملة.
3. جلب الباصات النشطة على هذه الخطوط.
4. فلترة الباصات المثالية:
   - يجب أن تكون على نفس `route_id` المطلوب.
   - إذا اتجاه الراكب `outbound`: الباص يجب أن يكون `outbound` وموقعه قبل أو عند موقف الراكب.
   - إذا اتجاه الراكب `inbound`: الباص يجب أن يكون `inbound` وموقعه بعد أو عند موقف الراكب.
5. إذا لم توجد باصات مثالية، يتم جلب باصات fallback من الاتجاه الآخر.
6. حساب المسافة التقريبية عبر جمع المسافات بين المواقف المتتالية، ثم ضربها بمعامل `DETOUR_FACTOR = 1.3` لأن الطريق الفعلي أطول من الخط المستقيم.
7. تقدير الزمن على سرعة وسطية `AVG_SPEED_KMH = 25`.
8. ترتيب النتائج حسب `stations_away`.

الناتج يوضح:

- اتجاه الراكب.
- الباصات المتاحة.
- عدد المواقف البعيدة.
- المسافة بالمتر.
- الزمن المتوقع.
- هل الباص مثالي أم fallback.

### 7.5 البحث الذكي عن وجهة

المسار:

```http
GET /api/stations/smart-search
```

الخدمة: `smartSearch(destination, passenger_lat, passenger_lng)`

المنطق:

1. البحث عن مواقف يحتوي اسمها على نص الوجهة.
2. جلب الخط المرتبط بكل موقف، مع مواقفه والباصات النشطة.
3. عند وجود إحداثيات الراكب، يتم إيجاد أقرب موقف له ضمن كل خط.
4. تحديد اتجاه الراكب بمقارنة ترتيب موقف الوجهة مع ترتيب أقرب موقف للراكب.
5. تحليل الباصات النشطة:
   - حساب فرق المواقف.
   - حساب المسافة بين الباص وموقف الركوب المحتمل.
   - تقدير الزمن.
   - تحديد `is_ideal` حسب اتجاه الباص وموقعه.
6. ترتيب الباصات المثالية أولاً ثم الأقرب.
7. ترتيب الخطوط حسب أفضل وقت وصول.

### 7.6 اقتراحات البحث Hybrid Suggestions

المسار:

```http
GET /api/stations/hybrid-suggestions
```

الخدمة تجمع بين مصدرين:

1. مواقف محفوظة في قاعدة البيانات.
2. مناطق جغرافية من OpenStreetMap Nominatim.

المنطق:

- يتم جلب اقتراحات المواقف أولاً.
- يتم جلب اقتراحات المناطق من Nominatim.
- يتم الدمج بدون تكرار.
- الحد الأقصى 8 نتائج.
- إذا فشل Nominatim، يرجع النظام اقتراحات المواقف فقط.

### 7.7 تخطيط الرحلة `planRouteV2`

المسار:

```http
GET /api/stations/plan-route-v2
```

هذه أهم خوارزمية في المشروع.

تدعم 3 حالات:

1. الوجهة لها إحداثيات مباشرة `destLat`, `destLng`.
2. الوجهة اسم موقف محفوظ.
3. الوجهة اسم منطقة، ويتم تحويلها لإحداثيات عبر Nominatim.

الثوابت المستخدمة:

```text
MAX_WALK_TO_START = 2000 متر
MAX_WALK_FROM_END = 1500 متر افتراضياً، وقد تصبح 3000 عند geocoding
TRANSFER_RADIUS = 800 متر
WALK_SPEED = 70 متر/دقيقة
MIN_PER_STATION = 3 دقائق
MAX_TOTAL_MINUTES = 90 دقيقة
```

#### المرحلة 1: تحليل الخطوط

لكل خط:

- إيجاد أقرب موقف من الراكب.
- إيجاد أقرب موقف من الوجهة.
- جلب الباصات النشطة على الخط.

#### المرحلة 2: الرحلات المباشرة

بدلاً من اختيار موقف ركوب واحد وموقف نزول واحد فقط، الخوارزمية تختار:

- أفضل 3 مواقف ركوب قريبة من الراكب.
- أفضل 3 مواقف نزول قريبة من الوجهة.

ثم تجرب كل التركيبات الممكنة بينهما.

لكل خطة مباشرة يتم حساب:

- وقت المشي إلى موقف البداية.
- عدد المواقف داخل الباص.
- وقت الباص.
- وقت المشي من موقف النزول إلى الوجهة.
- الزمن الكلي.
- إجمالي المشي.
- `effort_score` لترجيح الراحة.
- أقرب زمن وصول للباص `bus_eta`.

#### المرحلة 3: الرحلات مع تحويل

الخوارزمية تبحث عن رحلة من خط أول إلى خط ثانٍ:

1. تحديد مواقف ركوب قريبة من الراكب ضمن 2000 متر.
2. تحديد مواقف نزول قريبة من الوجهة.
3. تجربة خطوط مختلفة.
4. البحث عن نقطتي تحويل `s1` و`s2` بين الخطين، بشرط أن تكون المسافة بينهما أقل من `TRANSFER_RADIUS = 800` متر.
5. حساب:
   - ركوب الباص الأول.
   - المشي بين موقفي التحويل.
   - ركوب الباص الثاني.
   - المشي الأخير إلى الوجهة.

الخوارزمية لا تفرض اتجاه `order_index` بشكل صارم في التحويل، بل تستخدم `Math.abs` حتى لا تمنع تحويلات صحيحة عندما يكون الراكب قريباً من نهاية الخط.

#### المرحلة 4: اختيار أفضل اقتراحين

من كل الخطط المرشحة يتم اختيار:

- `fastest`: أقل زمن كلي، وعند التعادل أقل مشي.
- `comfort`: أقل مشي، وعند التعادل أقل زمن.

إذا كان الاقتراحان متطابقين، يرجع النظام اقتراحاً واحداً فقط.

### 7.8 تقدير وصول الباص ETA

الدالة `_calcBusEta`:

1. تأخذ الباصات النشطة على الخط.
2. تقارن `current_station_index` لكل باص مع موقف الركوب.
3. تختار أقل فرق مواقف.
4. تضرب الفرق في `MIN_PER_STATION`.

الناتج تقدير تقريبي بالدقائق.

### 7.9 التحقق من QR وخصم الرحلة

المسار:

```http
POST /api/buses/verify-qr
```

المنطق:

1. قراءة QR بصيغة:

```text
BUS-{bus_id}-{plate_number}
```

2. التحقق من الباص.
3. البحث عن اشتراك نشط للمستخدم.
4. إذا لم يوجد اشتراك مباشر، يتم البحث هل المستخدم عضو في اشتراك عائلي نشط.
5. التحقق من أن `trips_used < trips_limit`.
6. زيادة `trips_used` بمقدار 1.
7. إنشاء سجل في `Trip_History`.
8. إرجاع عدد الرحلات المستخدمة والمتبقية.

### 7.10 إغلاق الرحلات القديمة تلقائياً

في `Trip_History`:

- عند جلب رحلات المستخدم، يتم إغلاق أي رحلة مفتوحة أقدم من ساعتين.
- يتم وضع `to_station = إغلاق تلقائي`.

وفي `src/app.js` يوجد Job كل ساعة:

- يحول الورديات القديمة التي بقيت `active`, `paused`, `pending_stop` إلى `completed` إذا كان تاريخها قبل اليوم.

## 8. Socket.IO والتحديث اللحظي

الملف: `src/socket.js`

### 8.1 الغرف Rooms

| Room | الاستخدام |
|---|---|
| `admin` | كل المدراء |
| `passengers` | كل الركاب |
| `driver:{driver_id}` | سائق محدد |
| `user:{user_id}` | مستخدم محدد |
| `bus:{bus_id}` | متابعو باص محدد |
| `route:{route_id}` | متابعو خط محدد |

### 8.2 أحداث من العميل للسيرفر

| Event | الوصف |
|---|---|
| `join` | انضمام المستخدم لغرفة حسب دوره |
| `bus:track` | متابعة باص أو خط |
| `bus:untrack` | إيقاف المتابعة |
| `position:update` | السائق يرسل موقع الباص |

### 8.3 أحداث من السيرفر للعميل

| Event | الوصف |
|---|---|
| `bus:position` | تحديث موقع باص |
| `bus:status` | تغير حالة باص |
| `notification` | إشعار جديد |
| `shift:update` | تحديث وردية |

## 9. آلية عمل المشروع حسب نوع المستخدم

### 9.1 الراكب Passenger

السيناريوهات الأساسية:

1. يسجل حساباً أو يدخل بالبريد وكلمة المرور.
2. يبحث عن وجهة أو خط.
3. يحصل على اقتراحات مواقف أو مناطق.
4. يطلب تخطيط رحلة:
   - مباشرة.
   - أو مع تحويل.
   - مع إظهار الأسرع والأريح.
5. يتابع الباص على الخريطة عبر Socket.IO.
6. يشترك بخطة مباشرة أو عبر نقطة بيع.
7. يركب الباص عبر QR ويتم خصم رحلة من اشتراكه.
8. يرى سجل الرحلات.
9. يرسل بلاغات أو شكاوى.
10. يبلغ عن مفقودات أو يتابع مفقوداته.
11. يرى نقاط البيع النشطة القريبة على الخريطة.
12. يستقبل إشعارات عامة أو شخصية.

تدفق البحث عن وجهة للراكب:

```text
Passenger App
  -> /api/stations/hybrid-suggestions
  -> اختيار محطة أو منطقة
  -> /api/stations/plan-route-v2
  -> Backend يحلل الخطوط والمواقف والباصات
  -> يرجع fastest و comfort
  -> الراكب يختار خطة
  -> /api/bus-tracker/find-buses أو Socket bus:track
  -> تحديث موقع الباص لحظياً
```

### 9.2 السائق Driver

السيناريوهات الأساسية:

1. يدخل بالهاتف وكلمة المرور عبر `/api/auth/login-phone`.
2. يرى بياناته ووردياته.
3. يبدأ الدوام عبر `log-activity` مع action = `start`.
4. يرسل موقع الباص دورياً.
5. يغير حالة الباص عند الحاجة.
6. يرسل تنبيه تأخير.
7. يطلب باصاً إضافياً عند الازدحام.
8. يبلغ عن عطل.
9. ينهي الدوام بنظام تأكيد:
   - يطلب الإيقاف، فتتحول الوردية إلى `pending_stop`.
   - يمكنه تأكيد الإيقاف أو إلغاءه.

تدفق موقع السائق:

```text
Driver App
  -> يرسل lat/lng
  -> /api/bus-tracker/position/:bus_id أو Socket position:update
  -> Backend يحسب أقرب موقف ويحدث Buses
  -> Socket.IO يرسل bus:position للركاب المتابعين
```

تدفق إنهاء الدوام:

```text
Driver -> log-activity stop
  -> Shift تصبح pending_stop
  -> Driver يؤكد confirm-stop
  -> Shift تصبح completed مع actual_end
```

### 9.3 المدير Admin

السيناريوهات الأساسية:

1. إدارة المستخدمين.
2. إنشاء السائقين وربطهم بحسابات مستخدمين.
3. إدارة الباصات وحالاتها.
4. إنشاء الخطوط وربط خط الذهاب بخط الإياب.
5. إدارة المواقف وترتيبها وإحداثياتها.
6. إنشاء الورديات وتعيين السائق والباص.
7. إدارة خطط الاشتراك.
8. إدارة نقاط البيع وشحن أرصدتها.
9. متابعة البلاغات والأعطال والمفقودات.
10. إرسال إشعارات.
11. متابعة حالة الباصات والورديات لحظياً.

تدفق إنشاء خط صحيح:

```text
Admin
  -> POST /api/routes لإنشاء خط ذهاب
  -> POST /api/routes لإنشاء خط إياب
  -> POST /api/routes/link لربطهما عبر pair_route_id
  -> POST /api/stations لإضافة المواقف بالترتيب
  -> POST /api/buses لربط باص بالخط
```

### 9.4 نقطة البيع POS

رغم أن `pos` ليس ضمن enum `UserRole`، إلا أنه يحصل على JWT بدور `pos` من `/api/pos/login`.

السيناريوهات الأساسية:

1. الأدمن ينشئ نقطة بيع.
2. الأدمن يشحن رصيد نقطة البيع.
3. نقطة البيع تسجل دخولها بالهاتف وكلمة المرور.
4. نقطة البيع تبيع اشتراكاً لمستخدم عبر البريد.
5. النظام يتحقق من رصيد نقطة البيع.
6. يتم إلغاء أي اشتراك نشط سابق للمستخدم بجعله `expired`.
7. يتم إنشاء الاشتراك الجديد.
8. يتم خصم سعر الخطة من رصيد نقطة البيع.
9. يتم تسجيل العملية في `POS_Transactions`.

تدفق بيع اشتراك:

```text
POS
  -> POST /api/pos/sell
  -> تحقق من POS والرصيد
  -> تحقق من الخطة والمستخدم
  -> إلغاء الاشتراكات القديمة
  -> إنشاء اشتراك جديد
  -> خصم الرصيد
  -> تسجيل transaction
```

## 10. سير العمليات وتدفق البيانات

### 10.1 تدفق HTTP Request عام

```text
Client
  -> Express app
  -> Security middlewares: helmet, cors, rate limiter, json parser
  -> Route
  -> auth middleware إذا كان المسار محمياً
  -> role middleware إذا كان المسار يحتاج صلاحية
  -> validation middleware إذا كان له Joi schema
  -> controller
  -> service
  -> Prisma Client
  -> MySQL
  -> response JSON
```

### 10.2 تدفق الأخطاء

```text
Service throws { status, message }
  -> Controller next(error)
  -> error.middleware
  -> JSON response مناسب
```

### 10.3 تدفق تتبع الباص

```text
Driver sends location
  -> updateBusPosition
  -> get bus + route + stations
  -> calculate nearest station by Haversine
  -> update Buses current location
  -> maybe switch route when near last station
  -> emit bus:position
  -> Passenger receives live update
```

### 10.4 تدفق الاشتراك والركوب

```text
Passenger / POS creates subscription
  -> Subscriptions row active
  -> Passenger scans QR
  -> verifyQR
  -> validate active direct or family subscription
  -> check trips limit
  -> increment trips_used
  -> create Trip_History
  -> return remaining trips
```

### 10.5 تدفق البلاغات والإشعارات

```text
Passenger/Driver creates report or action
  -> Backend stores Reports/Issues/Notifications
  -> Socket.IO emits notification when needed
  -> Admin or Passenger receives notification
```

## 11. ميزات المشروع

- REST API منظم بوحدات مستقلة.
- قاعدة بيانات علائقية واضحة باستخدام Prisma.
- أدوار وصلاحيات للمستخدمين.
- تسجيل دخول بالبريد للراكب/الأدمن وبالهاتف للسائق.
- حماية JWT ومحدد طلبات Rate Limiting.
- تتبع لحظي للباصات عبر Socket.IO.
- إدارة خطوط ذهاب وإياب عبر `pair_route_id`.
- تبديل تلقائي للخط عند وصول الباص لآخر موقف.
- بحث ذكي عن الوجهات والمواقف.
- تخطيط رحلة مباشر أو مع تحويل.
- اقتراح خيارين للراكب: الأسرع والأريح.
- تقدير زمن وصول الباص بناءً على فرق المواقف.
- دعم الاشتراكات العائلية.
- خصم الرحلات عبر QR.
- إدارة نقاط بيع وعمليات بيع اشتراكات.
- إشعارات حسب الدور أو المستخدم المحدد.
- إدارة مفقودات مع صور مرفوعة.
- سجل رحلات للراكب.
- تنظيف تلقائي للورديات القديمة.
- Swagger UI لتصفح API.

## 12. قواعد تشغيل مهمة

### 12.1 متغيرات البيئة

المشروع يحتاج ملف `.env` يحتوي على الأقل:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="your-secret"
PORT=5000
```

### 12.2 أوامر التشغيل

```bash
npm install
npm run dev
npm start
npm run seed
```

### 12.3 Swagger

بعد تشغيل المشروع:

```text
http://localhost:5000/api/docs
```

### 12.4 Static Uploads

الصور المرفوعة متاحة عبر:

```text
/uploads/<filename>
```

## 13. ملاحظات هندسية

- نجاح البحث والتخطيط يعتمد بشدة على وجود `lat`, `lng`, و`order_index` لكل موقف.
- ربط خطوط الذهاب والإياب عبر `pair_route_id` أفضل من الاعتماد على اسم الخط.
- خوارزمية تخطيط الرحلة تستخدم تقديرات تقريبية، وليست محرك ملاحة كامل يعتمد على الطرق الفعلية.
- خدمة Nominatim الخارجية قد تفشل أو تتأخر، لذلك المشروع يحتوي fallback يرجع نتائج المواقف المحلية.
- يجب الانتباه إلى أن POS يستخدم role باسم `pos` داخل JWT رغم أنه غير موجود في enum `UserRole` لأنه ليس محفوظاً في جدول `Users`.
- بعض الرسائل داخل ملفات الكود ظاهرة بترميز غير صحيح، لكن المنطق البرمجي واضح ويعمل بمعزل عن عرض النصوص.

## 14. ملخص العلاقات الأساسية

```text
Users 1---1 Drivers
Users 1---* Subscriptions
Users *---* Subscriptions عبر Family_Members
Subscription_Plans 1---* Subscriptions
Routes 1---* Stations
Routes 1---* Buses
Routes 1---1 Routes عبر pair_route_id منطقياً
Buses 1---* Bus_Tracking_Log
Buses 1---* Shifts
Drivers 1---* Shifts
Users 1---* Trip_History
Buses 1---* Trip_History
POS_Points 1---* POS_Transactions
Users 1---* Reports / Issues / Lost_Items
Buses 1---* Reports / Issues / Lost_Items
```

## 15. أهم الملفات للرجوع إليها

| الملف | أهميته |
|---|---|
| `prisma/schema.prisma` | تعريف قاعدة البيانات والعلاقات |
| `src/app.js` | إعداد Express وربط المسارات والـ Swagger والتنظيف الدوري |
| `src/socket.js` | Socket.IO والتحديثات اللحظية |
| `src/modules/stations/stations.service.js` | البحث الذكي وتخطيط الرحلة |
| `src/modules/bus-tracker/bus-tracker.service.js` | تحديث موقع الباص والبحث عن باص للراكب |
| `src/modules/buses/buses.service.js` | إدارة الباصات وQR |
| `src/modules/subscriptions/subscriptions.service.js` | الاشتراكات والاشتراك العائلي |
| `src/modules/pos/pos.service.js` | نقاط البيع وبيع الاشتراكات |
| `src/modules/driver-actions/driver-actions.service.js` | عمليات السائق |
| `src/utils/geo.js` | حساب المسافات |
| `src/utils/geocoding.js` | التكامل مع OpenStreetMap Nominatim |
