const mongoose = require('mongoose');
const Xwang = require('../models/Xwang');
const Cosergirl = require('../models/Cosergirl');
const Character = require('../models/Character');
const logger = require('../utils/logger');

/**
 * 获取全局统计信息
 */
exports.getGlobalStats = async (req, res) => {
  try {
    const [xwangStats, cosergirlStats, characterStats] = await Promise.all([
      // xwang统计
      Xwang.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            starStats: [
              { $group: { _id: '$star', count: { $sum: 1 } } },
              { $sort: { _id: 1 } }
            ],
            characterCount: [
              { $group: { _id: '$character' } },
              { $count: 'count' }
            ],
            sizeStats: [
              {
                $group: {
                  _id: null,
                  totalSize: { $sum: '$size' },
                  avgSize: { $avg: '$size' },
                  maxSize: { $max: '$size' },
                  minSize: { $min: '$size' }
                }
              }
            ]
          }
        }
      ]),
      
      // cosergirl统计
      Cosergirl.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            starStats: [
              { $group: { _id: '$star', count: { $sum: 1 } } },
              { $sort: { _id: 1 } }
            ],
            characterCount: [
              { $group: { _id: '$character' } },
              { $count: 'count' }
            ],
            sizeStats: [
              {
                $group: {
                  _id: null,
                  totalSize: { $sum: '$size' },
                  avgSize: { $avg: '$size' },
                  maxSize: { $max: '$size' },
                  minSize: { $min: '$size' }
                }
              }
            ]
          }
        }
      ]),
      
      // character统计
      Character.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            starStats: [
              { $group: { _id: '$star', count: { $sum: 1 } } },
              { $sort: { _id: 1 } }
            ],
            ageRatingStats: [
              { $group: { _id: '$age_rating', count: { $sum: 1 } } },
              { $sort: { _id: 1 } }
            ]
          }
        }
      ])
    ]);
    
    // 格式化结果
    const result = {
      xwang: {
        total: xwangStats[0]?.total[0]?.count || 0,
        star_stats: formatStarStats(xwangStats[0]?.starStats || []),
        character_count: xwangStats[0]?.characterCount[0]?.count || 0,
        size_info: xwangStats[0]?.sizeStats[0] || {}
      },
      cosergirl: {
        total: cosergirlStats[0]?.total[0]?.count || 0,
        star_stats: formatStarStats(cosergirlStats[0]?.starStats || []),
        character_count: cosergirlStats[0]?.characterCount[0]?.count || 0,
        size_info: cosergirlStats[0]?.sizeStats[0] || {}
      },
      character: {
        total: characterStats[0]?.total[0]?.count || 0,
        star_stats: formatStarStats(characterStats[0]?.starStats || []),
        age_rating_stats: formatAgeRatingStats(characterStats[0]?.ageRatingStats || [])
      },
      summary: {
        total_items: (xwangStats[0]?.total[0]?.count || 0) + 
                    (cosergirlStats[0]?.total[0]?.count || 0) + 
                    (characterStats[0]?.total[0]?.count || 0),
        total_characters: (xwangStats[0]?.characterCount[0]?.count || 0) + 
                         (cosergirlStats[0]?.characterCount[0]?.count || 0),
        timestamp: new Date().toISOString()
      }
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('获取全局统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

/**
 * 批量操作接口
 */
exports.batchOperations = async (req, res) => {
  try {
    const { operation, collection, ids, data } = req.body;
    
    if (!operation || !collection || !ids || !Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    let model;
    switch (collection) {
      case 'xwang':
        model = Xwang;
        break;
      case 'cosergirl':
        model = Cosergirl;
        break;
      case 'character':
        model = Character;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: '不支持的集合类型'
        });
    }
    
    // 验证所有ID
    const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有有效的ID'
      });
    }
    
    let result;
    const updateData = {
      ...data,
      updated_at: new Date().toISOString()
    };
    
    if (collection === 'xwang' || collection === 'cosergirl') {
      updateData._updated_at = Date.now() / 1000;
    }
    
    switch (operation) {
      case 'update_star':
        if (data.star === undefined || typeof data.star !== 'number') {
          return res.status(400).json({
            success: false,
            message: 'star参数无效'
          });
        }
        
        if (data.star < 0 || data.star > 5) {
          return res.status(400).json({
            success: false,
            message: 'star值必须在0-5之间'
          });
        }
        
        result = await model.updateMany(
          { _id: { $in: validIds } },
          { $set: updateData }
        );
        break;
        
      case 'update_age_rating':
        if (collection !== 'character') {
          return res.status(400).json({
            success: false,
            message: 'age_rating只能更新character集合'
          });
        }
        
        if (data.age_rating === undefined || typeof data.age_rating !== 'number') {
          return res.status(400).json({
            success: false,
            message: 'age_rating参数无效'
          });
        }
        
        if (data.age_rating < 1 || data.age_rating > 5) {
          return res.status(400).json({
            success: false,
            message: 'age_rating值必须在1-5之间'
          });
        }
        
        result = await model.updateMany(
          { _id: { $in: validIds } },
          { $set: updateData }
        );
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: '不支持的批量操作'
        });
    }
    
    // 获取更新后的数据
    const updatedItems = await model.find({ _id: { $in: validIds } });
    
    logger.info(`批量操作: ${operation} on ${collection}, 更新${result.modifiedCount}个记录`);
    
    res.json({
      success: true,
      message: `成功更新${result.modifiedCount}个记录`,
      operation,
      collection,
      data: updatedItems,
      stats: {
        requested: ids.length,
        valid: validIds.length,
        updated: result.modifiedCount,
        matched: result.matchedCount
      }
    });
  } catch (error) {
    logger.error('批量操作错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 辅助函数：格式化star统计
function formatStarStats(stats) {
  const result = {};
  for (let i = 0; i <= 5; i++) {
    result[i] = 0;
  }
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
  });
  
  return result;
}

// 辅助函数：格式化age_rating统计
function formatAgeRatingStats(stats) {
  const result = {};
  for (let i = 1; i <= 5; i++) {
    result[i] = 0;
  }
  
  stats.forEach(stat => {
    result[stat._id] = stat.count;
  });
  
  return result;
}