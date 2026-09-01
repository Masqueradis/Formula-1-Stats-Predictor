function notFound(req, res, next) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack);

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({
      error: 'Operation violates a foreign key constraint',
      details: err.message,
    });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      error: 'Invalid data',
      details: err.message,
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
}

module.exports = { notFound, errorHandler };
