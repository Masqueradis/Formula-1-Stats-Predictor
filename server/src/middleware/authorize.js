function isAdmin(req, res, next) {
  if (req.user && req.user.role === 'ADMIN') {
    return next();
  }
  return res.status(403).json({ success: false, error: 'Admin access required' });
}

module.exports = { isAdmin };
