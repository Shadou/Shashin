const errorHandler = (err, req, res, next) => {
  console.error('错误:', err);
  
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    success: false,
    message: err.message || '服务器内部错误'
  });
};

module.exports = errorHandler;