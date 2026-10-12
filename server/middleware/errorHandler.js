export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, _next) {
  const uploadErrors = {
    LIMIT_FILE_SIZE: { status: 413, message: 'Invoice file is too large. Use a file within the upload size limit.' },
    LIMIT_FILE_COUNT: { status: 400, message: 'Upload one invoice file at a time.' },
    LIMIT_UNEXPECTED_FILE: { status: 400, message: 'Upload the invoice using the file field.' },
    LIMIT_FIELD_COUNT: { status: 400, message: 'Too many form fields were submitted.' },
    LIMIT_FIELD_VALUE: { status: 400, message: 'One of the submitted form fields is too long.' },
  };
  const knownUploadError = uploadErrors[error.code];
  const statusCode = knownUploadError?.status || error.statusCode || error.status || (error.name === 'ValidationError' ? 400 : error.code === 11000 ? 409 : 500);
  if (statusCode >= 500) console.error(error);
  res.status(statusCode).json({
    success: false,
    message: knownUploadError?.message || (error.code === 11000 ? 'A record with one of these unique fields already exists' : statusCode === 500 && process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message),
    ...(error.details ? { details: error.details } : {}),
    ...(error.name === 'ValidationError' ? { details: Object.values(error.errors).map((entry) => entry.message) } : {}),
  });
}
