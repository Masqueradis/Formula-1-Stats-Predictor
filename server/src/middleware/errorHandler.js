function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error('http.error', { message: err.message, stack: err.stack });

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({
      success: false,
      error: 'Operation violates a foreign key constraint',
      details: err.message,
    });
  }

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid data',
      details: err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
}

module.exports = { notFound, errorHandler };
