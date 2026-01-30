const mongoose = require('mongoose');
const Character = require('../models/Character');
const logger = require('../utils/logger');

// 辅助函数：获取age_rating信息
function getAgeRatingInfo(rating) {
  const ratings = {
    1: {
      level: 'G',
      description: '全年龄',
      min_age: 0,
      color: '#4CAF50',
      icon: '👶'
    },
    2: {
      level: 'PG',
      description: '建议家长指导',
      min_age: 12,
      color: '#2196F3',
      icon: '👦'
    },
    3: {
      level: 'PG-13',
      description: '13岁以上',
      min_age: 13,
      color: '#FF9800',
      icon: '👨'
    },
    4: {
      level: 'R',
      description: '限制级',
      min_age: 18,
      color: '#F44336',
      icon: '🔞'
    },
    5: {
      level: 'NC-17',
      description: '成人内容',
      min_age: 21,
      color: '#9C27B0',
      icon: '⚠️'
    }
  };
  
  return ratings[rating] || {
    level: '未知',
    description: '未知分级',
    min_age: 0,
    color: '#9E9E9E',
    icon: '❓'
  };
}

// 获取所有角色
const getAllCharacters = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, sortBy = 'name', order = 'asc' } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { names_like: { $regex: search, $options: 'i' } }
      ];
    }
    
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      Character.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Character.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('获取所有角色错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 获取单个角色
const getCharacterById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID格式不正确'
      });
    }
    
    const data = await Character.findById(id);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: '未找到角色'
      });
    }
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取角色详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 更新角色的age_rating
const updateAgeRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { age_rating } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID格式不正确'
      });
    }
    
    if (age_rating === undefined || typeof age_rating !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'age_rating参数必须为数字'
      });
    }
    
    if (age_rating < 1 || age_rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'age_rating值必须在1-5之间'
      });
    }
    
    const data = await Character.findByIdAndUpdate(
      id,
      { 
        age_rating, 
        updated_at: new Date().toISOString()
      },
      { new: true, runValidators: true }
    );
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: '未找到角色'
      });
    }
    
    logger.info(`更新角色age_rating: ${id} -> ${age_rating}`);
    
    res.json({
      success: true,
      data,
      age_rating_info: getAgeRatingInfo(age_rating)
    });
  } catch (error) {
    logger.error('更新age_rating错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 批量更新age_rating
const batchUpdateAgeRating = async (req, res) => {
  try {
    const { ids, age_rating } = req.body;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: 'ids参数必须是数组'
      });
    }
    
    if (age_rating === undefined || typeof age_rating !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'age_rating参数必须为数字'
      });
    }
    
    if (age_rating < 1 || age_rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'age_rating值必须在1-5之间'
      });
    }
    
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有有效的ID'
      });
    }
    
    const result = await Character.updateMany(
      { _id: { $in: validIds } },
      { 
        age_rating, 
        updated_at: new Date().toISOString()
      }
    );
    
    const updatedItems = await Character.find({ _id: { $in: validIds } });
    
    logger.info(`批量更新角色age_rating: ${result.modifiedCount}个记录被更新`);
    
    res.json({
      success: true,
      message: `成功更新${result.modifiedCount}个记录`,
      data: updatedItems,
      age_rating_info: getAgeRatingInfo(age_rating),
      stats: {
        total: validIds.length,
        updated: result.modifiedCount,
        matched: result.matchedCount
      }
    });
  } catch (error) {
    logger.error('批量更新age_rating错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 按age_rating筛选角色
const getByAgeRating = async (req, res) => {
  try {
    const { age_rating, page = 1, limit = 20, sortBy = 'name', order = 'asc' } = req.query;
    
    if (age_rating === undefined) {
      return res.status(400).json({
        success: false,
        message: 'age_rating参数不能为空'
      });
    }
    
    const ratingValue = parseInt(age_rating, 10);
    
    if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return res.status(400).json({
        success: false,
        message: 'age_rating值必须在1-5之间'
      });
    }
    
    const query = { age_rating: ratingValue };
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      Character.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Character.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      filter: {
        age_rating: ratingValue,
        description: getAgeRatingInfo(ratingValue)
      }
    });
  } catch (error) {
    logger.error('按age_rating筛选角色错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 获取age_rating统计
const getAgeRatingStats = async (req, res) => {
  try {
    const stats = await Character.aggregate([
      {
        $group: {
          _id: '$age_rating',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    const formattedStats = {};
    let total = 0;
    
    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      total += stat.count;
    });
    
    for (let i = 1; i <= 5; i++) {
      if (!formattedStats[i]) {
        formattedStats[i] = 0;
      }
    }
    
    const ageRatingInfo = {};
    for (let i = 1; i <= 5; i++) {
      ageRatingInfo[i] = getAgeRatingInfo(i);
    }
    
    res.json({
      success: true,
      data: formattedStats,
      total,
      descriptions: ageRatingInfo
    });
  } catch (error) {
    logger.error('获取age_rating统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 更新角色star状态
const updateStar = async (req, res) => {
  try {
    const { id } = req.params;
    const { star } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID格式不正确'
      });
    }
    
    if (star === undefined || typeof star !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'star参数必须为数字'
      });
    }
    
    if (star < 0 || star > 5) {
      return res.status(400).json({
        success: false,
        message: 'star值必须在0-5之间'
      });
    }
    
    const data = await Character.findByIdAndUpdate(
      id,
      { 
        star, 
        updated_at: new Date().toISOString()
      },
      { new: true, runValidators: true }
    );
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: '未找到角色'
      });
    }
    
    logger.info(`更新角色star: ${id} -> ${star}`);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('更新角色star错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// ... 现有代码保持不变 ...

/**
 * 获取star统计
 */
const getStarStats = async (req, res) => {
  try {
    const stats = await Character.aggregate([
      {
        $group: {
          _id: '$star',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    const formattedStats = {};
    let total = 0;
    
    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      total += stat.count;
    });
    
    for (let i = 0; i <= 5; i++) {
      if (!formattedStats[i]) {
        formattedStats[i] = 0;
      }
    }
    
    res.json({
      success: true,
      data: formattedStats,
      total,
      description: {
        0: '未收藏',
        1: '一般',
        2: '还行',
        3: '不错',
        4: '很好',
        5: '最爱'
      }
    });
  } catch (error) {
    logger.error('获取角色star统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

/**
 * 更新整个角色信息
 */
const updateCharacter = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID格式不正确'
      });
    }
    
    // 不允许更新的字段
    const disallowedFields = ['_id', 'id', 'created_at', '_created_at'];
    disallowedFields.forEach(field => {
      delete updateData[field];
    });
    
    // 添加更新时间
    updateData.updated_at = new Date().toISOString();
    
    const data = await Character.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: '未找到角色'
      });
    }
    
    logger.info(`更新角色: ${id}`);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('更新角色错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 在 module.exports 中添加 updateCharacter 方法
module.exports = {
  getAllCharacters,
  getCharacterById,
  updateCharacter,  // 新增
  updateAgeRating,
  batchUpdateAgeRating,
  getByAgeRating,
  getAgeRatingStats,
  updateStar,
  getStarStats
};