// controllers/cosergirlController.js
const mongoose = require('mongoose');
const path = require('path');
const Cosergirl = require('../models/Cosergirl');
const logger = require('../utils/logger');
const { getPathConfigById, getPathConfigsByOrigin } = require('../config/paths');

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

// 处理图像数组 - 将二维数组转换为对象数组
function normalizeImages(images) {
  if (!images || !Array.isArray(images)) return [];
  
  return images.map(image => {
    if (Array.isArray(image) && image.length >= 2) {
      return {
        path: image[0] || '',
        size: image[1] || 0
      };
    } else if (typeof image === 'object' && image.path !== undefined) {
      return image; // 已经是对象格式
    } else {
      return { path: '', size: 0 };
    }
  });
}

// 构建缩略图URL
function buildThumbnailUrl(rootId, relativePath, filename, origin = 'cosergirl', options = {}) {
  if (!relativePath || !filename) return null;
  
  const fullPath = path.join(relativePath, filename).replace(/\\/g, '/');
  const encodedPath = encodeURIComponent(fullPath);
  
  const queryParams = new URLSearchParams();
  queryParams.append('origin', origin);
  queryParams.append('root', rootId);
  queryParams.append('path', encodedPath);
  queryParams.append('thumb', 'true');
  
  // 添加缩略图选项
  if (options.width) queryParams.append('width', options.width);
  if (options.height) queryParams.append('height', options.height);
  if (options.quality) queryParams.append('quality', options.quality);
  
  return `/api/proxy/file?${queryParams.toString()}`;
}

// 修改构建文件URL的函数
function buildFileUrl(rootId, relativePath, filename, origin = 'cosergirl') {
  if (!relativePath || !filename) return null;
  
  const cleanRelativePath = relativePath.replace(/\\/g, '/');
  const cleanFilename = filename.replace(/\\/g, '/');
  
  const fullPath = path.join(cleanRelativePath, cleanFilename).replace(/\\/g, '/');
  const encodedPath = encodeURIComponent(fullPath);
  
  // 使用代理接口，支持缩略图参数
  return `/api/proxy/file?origin=${origin}&root=${rootId}&path=${encodedPath}`;
}

// 构建直接访问URL（备用）
function buildDirectFileUrl(rootId, relativePath, filename, origin = 'cosergirl') {
  if (!relativePath || !filename) return null;
  
  const cleanRelativePath = relativePath.replace(/\\/g, '/');
  const cleanFilename = filename.replace(/\\/g, '/');
  
  const fullPath = path.join(cleanRelativePath, cleanFilename).replace(/\\/g, '/');
  const encodedPath = encodeURIComponent(fullPath);
  
  // 直接访问接口，支持缩略图参数
  return `/api/files/origin/${origin}/${encodedPath}?root=${rootId}&thumb=true`;
}

// 获取所有cosergirl数据
const getAllCosergirl = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      character, 
      sortBy = 'updated_at', 
      order = 'desc',
      root,
      origin,
      includeFiles = 'false'
    } = req.query;
    
    const query = {};
    
    // 搜索条件
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { character: { $regex: search, $options: 'i' } },
        { 'metadata.original_name': { $regex: search, $options: 'i' } }
      ];
    }
    
    // 按角色筛选
    if (character) {
      query.character = character;
    }
    
    // 按root筛选
    if (root !== undefined && root !== '') {
      query.root = parseInt(root);
    }
    
    // 按origin筛选
    if (origin && origin !== '') {
      const pathConfigs = getPathConfigsByOrigin(origin);
      if (pathConfigs.length > 0) {
        const rootIds = pathConfigs.map(config => config.id);
        query.root = { $in: rootIds };
      }
    }
    
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    const shouldIncludeFiles = includeFiles === 'true';
    
    // 查询数据 - 不排除任何字段
    const [data, total] = await Promise.all([
      Cosergirl.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Cosergirl.countDocuments(query)
    ]);
    
    const enrichedData = data.map(item => {
      const pathConfig = getPathConfigById(item.root || 0);
      
      const result = {
        ...item,
        images: normalizeImages(item.images),
        videos: normalizeImages(item.videos)
      };
      
      if (pathConfig) {
        // ... 基础路径信息保持不变 ...
        
        // 为第一张图片构建封面图URL（使用缩略图）
        if (result.images && result.images.length > 0) {
          const firstImage = result.images[0];
          
          // 构建缩略图URL作为封面
          result.coverImage = buildThumbnailUrl(
            pathConfig.id, 
            item.path, 
            firstImage.path, 
            pathConfig.origin,
            { width: 400, height: 400, quality: 80 } // 封面图使用较小的尺寸
          );
          
          // 构建原图URL
          result.coverImageOriginal = buildFileUrl(
            pathConfig.id, 
            item.path, 
            firstImage.path, 
            pathConfig.origin
          );
          
          // 兼容旧的字段
          result.coverImageProxy = result.coverImage;
          result.coverImageById = result.coverImage;
          
          // 如果需要包含完整文件信息
          if (shouldIncludeFiles) {
            // 为所有图片构建URL（包含缩略图和原图）
            result.imagesWithUrls = result.images.map(image => ({
              ...image,
              url: buildFileUrl(  // 原图URL
                pathConfig.id,
                item.path,
                image.path,
                pathConfig.origin
              ),
              thumbnail: buildThumbnailUrl(  // 缩略图URL
                pathConfig.id,
                item.path,
                image.path,
                pathConfig.origin,
                { width: 800, height: 800, quality: 85 }
              ),
              proxyUrl: buildFileUrl(
                pathConfig.id,
                item.path,
                image.path,
                pathConfig.origin
              )
            }));
            
            // 为所有视频构建URL
            if (result.videos && result.videos.length > 0) {
              result.videosWithUrls = result.videos.map(video => ({
                ...video,
                url: buildFileUrl(
                  pathConfig.id,
                  item.path,
                  video.path,
                  pathConfig.origin
                ),
                proxyUrl: buildFileUrl(
                  pathConfig.id,
                  item.path,
                  video.path,
                  pathConfig.origin
                )
              }));
            }
            
            // 所有媒体文件
            result.allMedia = [
              ...(result.imagesWithUrls || []).map(img => ({ 
                ...img, 
                type: 'image',
                thumbnail: img.thumbnail // 包含缩略图
              })),
              ...(result.videosWithUrls || []).map(vid => ({ 
                ...vid, 
                type: 'video' 
              }))
            ];
          }
        }
        
        // 视频封面
        if (result.videos && result.videos.length > 0) {
          const firstVideo = result.videos[0];
          result.videoCoverImage = buildFileUrl(
            pathConfig.id,
            item.path,
            firstVideo.path,
            pathConfig.origin
          );
        }
      }
      
      return result;
    });
    
    res.json({
      success: true,
      data: enrichedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('获取所有cosergirl错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 获取单个cosergirl数据 - 始终包含完整文件信息
const getCosergirlById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID格式不正确'
      });
    }
    
    const data = await Cosergirl.findById(id).lean();
    
    if (!data) {
      return res.status(404).json({
        success: false,
        message: '未找到数据'
      });
    }
    
    const pathConfig = getPathConfigById(data.root || 0);
    
    const result = {
      ...data,
      // 标准化图像数据
      images: normalizeImages(data.images),
      // 标准化视频数据
      videos: normalizeImages(data.videos)
    };
    
    if (pathConfig) {
      result.fullPathInfo = {
        rootId: pathConfig.id,
        origin: pathConfig.origin,
        basePath: pathConfig.path,
        fullPath: data.path ? path.join(pathConfig.path, data.path) : pathConfig.path
      };
      
       // 处理图片（包含缩略图）
      if (result.images && result.images.length > 0) {
        result.imagesWithUrls = result.images.map(image => ({
          ...image,
          url: buildFileUrl(  // 原图URL
            pathConfig.id,
            data.path,
            image.path,
            pathConfig.origin
          ),
          thumbnail: buildThumbnailUrl(  // 缩略图URL
            pathConfig.id,
            data.path,
            image.path,
            pathConfig.origin,
            { width: 800, height: 800, quality: 85 }
          ),
          proxyUrl: buildFileUrl(
            pathConfig.id,
            data.path,
            image.path,
            pathConfig.origin
          )
        }));
        
        // 封面图片（使用缩略图）
        if (result.imagesWithUrls.length > 0) {
          const firstImage = result.imagesWithUrls[0];
          result.coverImage = firstImage.thumbnail;  // 缩略图
          result.coverImageOriginal = firstImage.url; // 原图
          result.coverImageById = firstImage.url;
          result.coverImageProxy = firstImage.proxyUrl;
        }
      }
      
      // 处理视频
      if (result.videos && result.videos.length > 0) {
        result.videosWithUrls = result.videos.map(video => ({
          ...video,
          url: buildDirectFileUrl(
            pathConfig.id,
            data.path,
            video.path,
            pathConfig.origin
          ),
          proxyUrl: buildFileUrl(
            pathConfig.id,
            data.path,
            video.path,
            pathConfig.origin
          )
        }));
        
        // 视频封面
        if (result.videosWithUrls.length > 0) {
          const firstVideo = result.videosWithUrls[0];
          result.videoCoverImage = firstVideo.url;
        }
      }
      
      // 所有媒体文件
      result.allMedia = [
        ...(result.imagesWithUrls || []).map(img => ({ ...img, type: 'image' })),
        ...(result.videosWithUrls || []).map(vid => ({ ...vid, type: 'video' }))
      ];
    }
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('获取cosergirl详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

// 按star状态筛选cosergirl数据
const getByStar = async (req, res) => {
  try {
    const { 
      star, 
      page = 1, 
      limit = 20, 
      sortBy = 'updated_at', 
      order = 'desc',
      root,
      origin,
      includeFiles = 'false'
    } = req.query;
    
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
    
    // 按root筛选
    if (root !== undefined && root !== '') {
      query.root = parseInt(root);
    }
    
    // 按origin筛选
    if (origin && origin !== '') {
      const pathConfigs = getPathConfigsByOrigin(origin);
      if (pathConfigs.length > 0) {
        const rootIds = pathConfigs.map(config => config.id);
        query.root = { $in: rootIds };
      }
    }
    
    const sort = {};
    sort[sortBy] = order === 'desc' ? -1 : 1;
    
    const skip = (page - 1) * limit;
    const shouldIncludeFiles = includeFiles === 'true';
    
    const [data, total] = await Promise.all([
      Cosergirl.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Cosergirl.countDocuments(query)
    ]);
    
    const enrichedData = data.map(item => {
      const pathConfig = getPathConfigById(item.root || 0);
      
      const result = {
        ...item,
        // 标准化图像数据
        images: normalizeImages(item.images),
        // 标准化视频数据
        videos: normalizeImages(item.videos)
      };
      
      if (pathConfig) {
        result.fullPathInfo = {
          rootId: pathConfig.id,
          origin: pathConfig.origin,
          basePath: pathConfig.path,
          fullPath: item.path ? path.join(pathConfig.path, item.path) : pathConfig.path
        };
        
        // 为第一张图片构建封面图URL
        if (result.images && result.images.length > 0) {
          const firstImage = result.images[0];
          
          result.coverImageProxy = buildFileUrl(
            pathConfig.id,
            item.path,
            firstImage.path,
            pathConfig.origin
          );
          
          result.coverImage = buildDirectFileUrl(
            pathConfig.id,
            item.path,
            firstImage.path,
            pathConfig.origin
          );
          
          result.coverImageById = result.coverImage;
          
          // 如果需要包含完整文件信息
          if (shouldIncludeFiles) {
            // 为所有图片构建URL
            result.imagesWithUrls = result.images.map(image => ({
              ...image,
              url: buildDirectFileUrl(
                pathConfig.id,
                item.path,
                image.path,
                pathConfig.origin
              ),
              proxyUrl: buildFileUrl(
                pathConfig.id,
                item.path,
                image.path,
                pathConfig.origin
              )
            }));
            
            // 为所有视频构建URL
            if (result.videos && result.videos.length > 0) {
              result.videosWithUrls = result.videos.map(video => ({
                ...video,
                url: buildDirectFileUrl(
                  pathConfig.id,
                  item.path,
                  video.path,
                  pathConfig.origin
                ),
                proxyUrl: buildFileUrl(
                  pathConfig.id,
                  item.path,
                  video.path,
                  pathConfig.origin
                )
              }));
            }
            
            // 所有媒体文件
            result.allMedia = [
              ...(result.imagesWithUrls || []).map(img => ({ ...img, type: 'image' })),
              ...(result.videosWithUrls || []).map(vid => ({ ...vid, type: 'video' }))
            ];
          }
        }
      }
      
      return result;
    });
    
    res.json({
      success: true,
      data: enrichedData,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      filter: {
        star: starValue,
        description: getStarDescription(starValue),
        root: root !== undefined && root !== '' ? parseInt(root) : '全部',
        origin: origin || '全部'
      }
    });
  } catch (error) {
    logger.error('按star筛选cosergirl错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 更新单个cosergirl的star状态
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
    
    const data = await Cosergirl.findByIdAndUpdate(
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
    
    logger.info(`更新cosergirl star: ${id} -> ${star}`);
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    logger.error('更新cosergirl star错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 批量更新star状态
const batchUpdateStar = async (req, res) => {
  try {
    const { ids, star, root } = req.body;
    
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
    
    const updateQuery = { _id: { $in: validIds } };
    
    if (root !== undefined) {
      updateQuery.root = parseInt(root);
    }
    
    const result = await Cosergirl.updateMany(
      updateQuery,
      { 
        star, 
        updated_at: new Date().toISOString(),
        _updated_at: Date.now() / 1000
      }
    );
    
    const updatedItems = await Cosergirl.find({ _id: { $in: validIds } });
    
    logger.info(`批量更新cosergirl star: ${result.modifiedCount}个记录被更新`);
    
    res.json({
      success: true,
      message: `成功更新${result.modifiedCount}个记录`,
      data: updatedItems,
      filter: root !== undefined ? { root } : null,
      stats: {
        total: validIds.length,
        updated: result.modifiedCount,
        matched: result.matchedCount
      }
    });
  } catch (error) {
    logger.error('批量更新cosergirl star错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 获取star统计
const getStarStats = async (req, res) => {
  try {
    const { root, origin } = req.query;
    
    const matchStage = {};
    
    if (root !== undefined && root !== '') {
      matchStage.root = parseInt(root);
    }
    
    if (origin && origin !== '') {
      const pathConfigs = getPathConfigsByOrigin(origin);
      if (pathConfigs.length > 0) {
        const rootIds = pathConfigs.map(config => config.id);
        matchStage.root = { $in: rootIds };
      }
    }
    
    const stats = await Cosergirl.aggregate([
      { $match: matchStage },
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
      filter: {
        root: root !== undefined && root !== '' ? parseInt(root) : '全部',
        origin: origin || '全部'
      },
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
    logger.error('获取cosergirl star统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 按root获取统计信息
const getStatsByRoot = async (req, res) => {
  try {
    const stats = await Cosergirl.aggregate([
      {
        $group: {
          _id: '$root',
          count: { $sum: 1 },
          star0: { $sum: { $cond: [{ $eq: ['$star', 0] }, 1, 0] } },
          star1: { $sum: { $cond: [{ $eq: ['$star', 1] }, 1, 0] } },
          star2: { $sum: { $cond: [{ $eq: ['$star', 2] }, 1, 0] } },
          star3: { $sum: { $cond: [{ $eq: ['$star', 3] }, 1, 0] } },
          star4: { $sum: { $cond: [{ $eq: ['$star', 4] }, 1, 0] } },
          star5: { $sum: { $cond: [{ $eq: ['$star', 5] }, 1, 0] } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    const statsWithPath = stats.map(stat => {
      const pathConfig = getPathConfigById(stat._id || 0);
      const totalStars = stat.star1 + stat.star2 + stat.star3 + stat.star4 + stat.star5;
      
      return {
        rootId: stat._id,
        pathConfig: pathConfig || null,
        count: stat.count,
        starCounts: {
          0: stat.star0,
          1: stat.star1,
          2: stat.star2,
          3: stat.star3,
          4: stat.star4,
          5: stat.star5
        },
        totalStars,
        starPercentage: stat.count > 0 ? Math.round((totalStars / stat.count) * 100) : 0
      };
    });
    
    res.json({
      success: true,
      data: statsWithPath,
      total: stats.reduce((sum, stat) => sum + stat.count, 0)
    });
  } catch (error) {
    logger.error('获取root统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 获取所有可用的root值
const getAvailableRoots = async (req, res) => {
  try {
    const roots = await Cosergirl.distinct('root');
    
    const rootsWithPath = roots.map(rootId => {
      const pathConfig = getPathConfigById(rootId);
      return {
        root: rootId,
        pathConfig: pathConfig || null,
        exists: !!pathConfig
      };
    });
    
    res.json({
      success: true,
      data: rootsWithPath
    });
  } catch (error) {
    logger.error('获取可用roots错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 按origin获取统计信息
const getStatsByOrigin = async (req, res) => {
  try {
    const { origin } = req.params;
    
    const pathConfigs = getPathConfigsByOrigin(origin);
    
    if (pathConfigs.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: `未找到origin为${origin}的路径配置`
      });
    }
    
    const rootIds = pathConfigs.map(config => config.id);
    
    const stats = await Cosergirl.aggregate([
      {
        $match: { root: { $in: rootIds } }
      },
      {
        $group: {
          _id: '$root',
          count: { $sum: 1 },
          totalStars: { $sum: { $cond: [{ $gt: ['$star', 0] }, 1, 0] } }
        }
      }
    ]);
    
    const statsWithPath = stats.map(stat => {
      const pathConfig = getPathConfigById(stat._id);
      return {
        rootId: stat._id,
        pathConfig: pathConfig || null,
        count: stat.count,
        totalStars: stat.totalStars,
        starPercentage: stat.count > 0 ? Math.round((stat.totalStars / stat.count) * 100) : 0
      };
    });
    
    const totalCount = stats.reduce((sum, stat) => sum + stat.count, 0);
    const totalStars = stats.reduce((sum, stat) => sum + stat.totalStars, 0);
    
    res.json({
      success: true,
      origin,
      data: statsWithPath,
      summary: {
        totalRoots: pathConfigs.length,
        totalCount,
        totalStars,
        starPercentage: totalCount > 0 ? Math.round((totalStars / totalCount) * 100) : 0
      }
    });
  } catch (error) {
    logger.error('获取origin统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};

// 导出所有方法
module.exports = {
  getAllCosergirl,
  getCosergirlById,
  updateStar,
  batchUpdateStar,
  getByStar,
  getStarStats,
  getStatsByRoot,
  getAvailableRoots,
  getStatsByOrigin
};