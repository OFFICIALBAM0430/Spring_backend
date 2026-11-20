function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  console.error(err.stack || err.message || err);
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
    }),
  });
}

module.exports = errorHandler;