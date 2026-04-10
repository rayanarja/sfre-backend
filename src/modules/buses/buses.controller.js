const busesService = require('./buses.service');

const getAll = async (req, res, next) => {
  try {
    const buses = await busesService.getAllBuses();
    res.json(buses);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const bus = await busesService.getBusById(req.params.id);
    res.json(bus);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const bus = await busesService.createBus(req.body);
    res.status(201).json(bus);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    // إذا السائق بيحاول يغيّر حالة الباص — تحقق إنو مو بالصيانة
    if (req.user.role === 'driver' && req.body.current_status) {
      const bus = await busesService.getBusById(req.params.id);
      if (bus.current_status === 'maintenance' || bus.current_status === 'breakdown') {
        return res.status(403).json({ message: 'الباص بالصيانة — فقط المدير يقدر يرجعو للخدمة' });
      }
    }
    const bus = await busesService.updateBus(req.params.id, req.body);
    res.json(bus);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await busesService.deleteBus(req.params.id);
    res.json({ message: 'تم حذف الباص بنجاح' });
  } catch (err) { next(err); }
};

const nearby = async (req, res, next) => {
  try {
    const { station_id } = req.query;
    if (!station_id) return res.status(400).json({ message: 'أدخل station_id' });
    res.json(await busesService.getNearbyBuses(station_id));
  } catch (err) { next(err); }
};

const getQR = async (req, res, next) => {
  try {
    res.json(await busesService.generateQR(req.params.id));
  } catch (err) { next(err); }
};

const verifyQR = async (req, res, next) => {
  try {
    const { qr_data, user_id } = req.body;
    res.json(await busesService.verifyQR(qr_data, user_id));
  } catch (err) { next(err); }
};

module.exports = { getAll, getOne, create, update, remove, nearby, getQR, verifyQR };