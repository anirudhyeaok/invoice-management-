export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : error.code === 11000 ? 409 : 500);
  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    success: false,
    message: error.code === 11000 ? 'A record with one of these unique fields already exists' : statusCode === 500 && process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    ...(error.details ? { details: error.details } : {}),
    ...(error.name === 'ValidationError' ? { details: Object.values(error.errors).map((entry) => entry.message) } : {}),
  });
}
