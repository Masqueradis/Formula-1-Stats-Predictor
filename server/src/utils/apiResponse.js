function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

function created(res, data) {
  return success(res, data, 201);
}

function error(res, message, statusCode = 400, details = null) {
  const body = {
    success: false,
    error: message,
  };
  if (details) {
    body.details = details;
  }
  return res.status(statusCode).json(body);
}

function notFound(res, resource = 'Resource') {
  return error(res, `${resource} not found`, 404);
}

function paginated(res, { rows, count, page, limit }) {
  return res.status(200).json({
    success: true,
    data: rows,
    pagination: {
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit),
    },
  });
}

module.exports = { success, created, error, notFound, paginated };
