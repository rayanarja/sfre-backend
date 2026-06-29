/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username: { type: string, example: "أحمد" }
 *               email: { type: string, example: "ahmed@test.com" }
 *               password: { type: string, example: "123456" }
 *               phone: { type: string, example: "0912345678" }
 *     responses:
 *       200: { description: Success }
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Token + user data }
 *
 * /auth/login-phone:
 *   post:
 *     tags: [Auth]
 *     summary: Login with phone (drivers)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Token + user + driver data }
 *
 * /buses:
 *   get:
 *     tags: [Buses]
 *     summary: Get all buses (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Paginated list of buses }
 *   post:
 *     tags: [Buses]
 *     summary: Create bus (admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plate_number]
 *             properties:
 *               plate_number: { type: string, example: "111" }
 *               route_id: { type: integer }
 *     responses:
 *       200: { description: Created bus }
 *
 * /routes:
 *   get:
 *     tags: [Routes]
 *     summary: Get all routes with stations
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of routes }
 *   post:
 *     tags: [Routes]
 *     summary: Create route (admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [route_name]
 *             properties:
 *               route_name: { type: string, example: "حلب الجديدة — ذهاب" }
 *               description: { type: string }
 *     responses:
 *       200: { description: Created route }
 *
 * /routes/link:
 *   post:
 *     tags: [Routes]
 *     summary: Link two routes (outbound ↔ inbound)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [route1_id, route2_id]
 *             properties:
 *               route1_id: { type: integer, description: "Outbound route" }
 *               route2_id: { type: integer, description: "Inbound route" }
 *     responses:
 *       200: { description: Routes linked }
 *
 * /drivers:
 *   get:
 *     tags: [Drivers]
 *     summary: Get all drivers
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of drivers }
 *   post:
 *     tags: [Drivers]
 *     summary: Create driver (admin)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, phone]
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               password: { type: string, default: "driver123" }
 *     responses:
 *       200: { description: Created driver }
 *
 * /shifts:
 *   get:
 *     tags: [Shifts]
 *     summary: Get all shifts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of shifts }
 *
 * /driver-actions/log-activity:
 *   post:
 *     tags: [Driver Actions]
 *     summary: Start/stop driver shift
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [driver_id, bus_id, action]
 *             properties:
 *               driver_id: { type: integer }
 *               bus_id: { type: integer }
 *               action: { type: string, enum: [start, stop] }
 *     responses:
 *       200: { description: Activity logged (pending=true if stop needs confirmation) }
 *
 * /driver-actions/confirm-stop:
 *   post:
 *     tags: [Driver Actions]
 *     summary: Confirm shift end
 *     security: [{ bearerAuth: [] }]
 *
 * /driver-actions/cancel-stop:
 *   post:
 *     tags: [Driver Actions]
 *     summary: Undo accidental stop
 *     security: [{ bearerAuth: [] }]
 *
 * /subscriptions:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get all subscriptions (admin)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated subscriptions }
 *
 * /pos/sell:
 *   post:
 *     tags: [POS]
 *     summary: Sell subscription to passenger
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pos_id, user_email, plan_id]
 *             properties:
 *               pos_id: { type: integer }
 *               user_email: { type: string }
 *               plan_id: { type: integer }
 *     responses:
 *       200: { description: Subscription activated }
 *
 * /bus-tracker/position/{bus_id}:
 *   put:
 *     tags: [Tracking]
 *     summary: Update bus GPS position
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: bus_id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat: { type: number, example: 36.21 }
 *               lng: { type: number, example: 37.13 }
 *     responses:
 *       200: { description: Position updated with nearest station }
 *
 * /bus-tracker/map:
 *   get:
 *     tags: [Tracking]
 *     summary: Get bus locations for map markers
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: route_id, schema: { type: integer } }
 *       - { in: query, name: status, schema: { type: string, enum: [active, inactive, maintenance, breakdown, all], default: active } }
 *     responses:
 *       200: { description: List of buses that have current coordinates }
 *
 * /stations/smart-search:
 *   get:
 *     tags: [Stations]
 *     summary: Smart search for routes by destination
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: destination, required: true, schema: { type: string } }
 *       - { in: query, name: lat, schema: { type: number } }
 *       - { in: query, name: lng, schema: { type: number } }
 *     responses:
 *       200: { description: Routes with ETA and nearest buses }
 *
 * /notifications/user/{user_id}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get user notifications by role
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: user_id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Filtered notifications }
 */
