const mongoose = require('mongoose');
const Xwang = require('../models/Xwang');
const Character = require('../models/Character');
const logger = require('../utils/logger');

// 辅助函数：获取star描述
function getStarDescription(star) {
  const descriptions = {
    0: '未收藏',
    1: '一般',
    2: '还行',
    3: '不错',
    4: '很好',
    5: '最爱'
  };
  return descriptions[star] || '未知';
}

// 获取所有xwang数据
const getAllXwang = async (req, res) => {
  try {
    const { page = 1, limit = 20, search, character, sortBy = 'updated_at', order = 'desc' } = req.query;
    
    const query = {};
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { character: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (character) {
      query.character = character;
    }
    
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      Xwang.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Xwang.countDocuments(query)
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
    logger.error('获取所有xwang错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 获取单个xwang数据
const getXwangById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID格式不正确'
      });
    }
    
    const data = await Xwang.findById(id);
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: '未找到数据'
      });
    }
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('获取xwang详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 搜索xwang数据（包含相似角色）
const searchXwangWithSimilar = async (req, res) => {
  try {
    const { name, page = 1, limit = 20 } = req.query;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: '请输入搜索名称'
      });
    }
    
    res.json({
      success: true,
      message: '搜索功能待实现',
      name
    });
  } catch (error) {
    logger.error('搜索xwang错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 更新单个xwang的star状态
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
    
    const data = await Xwang.findByIdAndUpdate(
      id,
      { 
        star, 
        updated_at: new Date().toISOString(),
        _updated_at: Date.now() / 1000
      },
      { new: true, runValidators: true }
    );
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: '未找到数据'
      });
    }
    
    logger.info(`更新xwang star: ${id} -> ${star}`);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('更新xwang star错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 批量更新star状态
const batchUpdateStar = async (req, res) => {
  try {
    const { ids, star } = req.body;
    
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: 'ids参数必须是数组'
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
    
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有有效的ID'
      });
    }
    
    const result = await Xwang.updateMany(
      { _id: { $in: validIds } },
      { 
        star, 
        updated_at: new Date().toISOString(),
        _updated_at: Date.now() / 1000
      }
    );
    
    const updatedItems = await Xwang.find({ _id: { $in: validIds } });
    
    logger.info(`批量更新xwang star: ${result.modifiedCount}个记录被更新`);
    
    res.json({
      success: true,
      message: `成功更新${result.modifiedCount}个记录`,
      data: updatedItems,
      stats: {
        total: validIds.length,
        updated: result.modifiedCount,
        matched: result.matchedCount
      }
    });
  } catch (error) {
    logger.error('批量更新xwang star错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 按star状态筛选xwang数据
const getByStar = async (req, res) => {
  try {
    const { star, page = 1, limit = 20, sortBy = 'updated_at', order = 'desc' } = req.query;
    
    if (star === undefined) {
      return res.status(400).json({
        success: false,
        message: 'star参数不能为空'
      });
    }
    
    const starValue = parseInt(star, 10);
    
    if (isNaN(starValue) || starValue < 0 || starValue > 5) {
      return res.status(400).json({
        success: false,
        message: 'star值必须在0-5之间'
      });
    }
    
    const query = { star: starValue };
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    
    const [data, total] = await Promise.all([
      Xwang.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Xwang.countDocuments(query)
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
        star: starValue,
        description: getStarDescription(starValue)
      }
    });
  } catch (error) {
    logger.error('按star筛选xwang错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 获取star统计
const getStarStats = async (req, res) => {
  try {
    const stats = await Xwang.aggregate([
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
    logger.error('获取star统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 导出所有方法
module.exports = {
  getAllXwang,
  getXwangById,
  searchXwangWithSimilar,
  updateStar,
  batchUpdateStar,
  getByStar,
  getStarStats
};