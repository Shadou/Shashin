const express = require('express');
const router = express.Router();

// 测试路由是否正常工作
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: '字符路由测试成功',
    timestamp: new Date().toISOString()
  });
});

// 导入控制器
const characterController = require('../controllers/characterController');

// 检查控制器方法是否存在
console.log('characterController 方法:', Object.keys(characterController));

// 路由定义
if (characterController.getAllCharacters) {
  router.get('/', characterController.getAllCharacters);
  console.log('✓ 注册路由: GET /');
} else {
  console.error('✗ characterController.getAllCharacters 不存在');
}

if (characterController.getCharacterById) {
  router.get('/:id', characterController.getCharacterById);
  console.log('✓ 注册路由: GET /:id');
} else {
  console.error('✗ characterController.getCharacterById 不存在');
}

// 添加 PUT 路由 - 更新整个角色信息
if (characterController.updateCharacter) {
  router.put('/:id', characterController.updateCharacter);
  console.log('✓ 注册路由: PUT /:id');
} else {
  console.error('✗ characterController.updateCharacter 不存在');
}

if (characterController.getByAgeRating) {
  router.get('/filter/age-rating', characterController.getByAgeRating);
  console.log('✓ 注册路由: GET /filter/age-rating');
} else {
  console.error('✗ characterController.getByAgeRating 不存在');
}

if (characterController.getAgeRatingStats) {
  router.get('/stats/age-rating', characterController.getAgeRatingStats);
  console.log('✓ 注册路由: GET /stats/age-rating');
} else {
  console.error('✗ characterController.getAgeRatingStats 不存在');
}

// 特别注意：添加star统计路由
if (characterController.getStarStats) {
  router.get('/stats/star', characterController.getStarStats);
  console.log('✓ 注册路由: GET /stats/star');
} else {
  console.error('✗ characterController.getStarStats 不存在');
}

if (characterController.updateAgeRating) {
  router.patch('/:id/age-rating', characterController.updateAgeRating);
  console.log('✓ 注册路由: PATCH /:id/age-rating');
} else {
  console.error('✗ characterController.updateAgeRating 不存在');
}

if (characterController.updateStar) {
  router.patch('/:id/star', characterController.updateStar);
  console.log('✓ 注册路由: PATCH /:id/star');
} else {
  console.error('✗ characterController.updateStar 不存在');
}

if (characterController.batchUpdateAgeRating) {
  router.patch('/batch/age-rating', characterController.batchUpdateAgeRating);
  console.log('✓ 注册路由: PATCH /batch/age-rating');
} else {
  console.error('✗ characterController.batchUpdateAgeRating 不存在');
}

module.exports = router;
