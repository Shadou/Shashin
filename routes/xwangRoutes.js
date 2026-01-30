const express = require('express');
const router = express.Router();

// 直接在这里打印查看导入的控制器
try {
  const xwangController = require('../controllers/xwangController');
  console.log('xwangController 方法列表:', Object.keys(xwangController));
  
  // 获取所有 xwang 数据
  router.get('/', xwangController.getAllXwang);
  
  // 搜索 xwang 数据（包含相似角色）
  router.get('/search', xwangController.searchXwangWithSimilar);
  
  // 获取单个 xwang 数据
  router.get('/:id', xwangController.getXwangById);
  
  // 按star状态筛选 - 检查方法是否存在
  if (xwangController.getByStar) {
    router.get('/filter/star', xwangController.getByStar);
  } else {
    console.error('xwangController.getByStar 方法不存在');
  }
  
  // 获取star统计 - 检查方法是否存在
  if (xwangController.getStarStats) {
    router.get('/stats/star', xwangController.getStarStats);
  } else {
    console.error('xwangController.getStarStats 方法不存在');
  }
  
  // 批量更新star状态 - 检查方法是否存在
  if (xwangController.batchUpdateStar) {
    router.patch('/batch/star', xwangController.batchUpdateStar);
  } else {
    console.error('xwangController.batchUpdateStar 方法不存在');
  }
  
  // 更新单个star状态 - 检查方法是否存在
  if (xwangController.updateStar) {
    router.patch('/:id/star', xwangController.updateStar);
  } else {
    console.error('xwangController.updateStar 方法不存在');
  }
  
} catch (error) {
  console.error('加载xwangController失败:', error);
}

module.exports = router;