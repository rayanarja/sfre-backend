/**
 * Role-Based Authorization Middleware
 * يتحقق من صلاحية المستخدم بناءً على دوره
 * يُستخدم بعد authMiddleware دائماً
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'يجب تسجيل الدخول أولاً' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'ليس لديك صلاحية لتنفيذ هذه العملية',
        required_role: roles,
        your_role: req.user.role,
      });
    }

    next();
  };
};

module.exports = authorize;
