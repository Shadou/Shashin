// routes/cosergirlRoutes.js
const express = require('express');
const router = express.Router();

try {
  const cosergirlController = require('../controllers/cosergirlController');
  
  // 获取所有 cosergirl 数据
  router.get('/', cosergirlController.getAllCosergirl);
  
  // 获取单个 cosergirl 数据
  router.get('/:id', cosergirlController.getCosergirlById);
  
  // 按star状态筛选
  router.get('/filter/star', cosergirlController.getByStar);
  
  // 获取star统计
  router.get('/stats/star', cosergirlController.getStarStats);
  
  // 获取root统计
  router.get('/stats/root', cosergirlController.getStatsByRoot);
  
  // 获取origin统计
  router.get('/stats/origin/:origin', cosergirlController.getStatsByOrigin);
  
  // 获取所有可用的root值
  router.get('/roots/available', cosergirlController.getAvailableRoots);
  
  // 批量更新star状态
  router.patch('/batch/star', cosergirlController.batchUpdateStar);
  
  // 更新单个star状态
  router.patch('/:id/star', cosergirlController.updateStar);
  
} catch (error) {
  console.error('加载cosergirlController失败:', error);
}

module.exports = router;