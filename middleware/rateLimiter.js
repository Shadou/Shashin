const rateLimit = require('express-rate-limit');

// 使用默认值，避免环境变量解析问题
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100000, // 限制每个IP 100个请求
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // 跳过健康检查
    return req.path === '/api/health';
  }
});

module.exports = limiter;