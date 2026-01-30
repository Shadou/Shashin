const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// 获取全局统计
router.get('/stats/global', adminController.getGlobalStats);

// 批量操作
router.post('/batch', adminController.batchOperations);

module.exports = router;