// utils/fileUtils.js
const path = require('path');
const fs = require('fs');
const { getPathConfigById } = require('../config/paths');

/**
 * 获取xwang的实际文件路径
 */
const getXwangFilePath = (xwangItem, filename) => {
  const basePath = process.env.XWANG_STATIC_PATH || 'D:/Files/xwang';
  
  // 方法1: 尝试使用xid作为目录
  if (xwangItem.xid) {
    const xidPath = path.join(basePath, xwangItem.xid);
    if (fs.existsSync(xidPath)) {
      return path.join(xidPath, filename);
    }
  }
  
  // 方法2: 尝试使用character_id作为目录
  if (xwangItem.character_id) {
    const charIdPath = path.join(basePath, xwangItem.character_id.toString());
    if (fs.existsSync(charIdPath)) {
      return path.join(charIdPath, filename);
    }
  }
  
  // 方法3: 使用character和title构建路径
  const charTitlePath = path.join(
    basePath, 
    xwangItem.character || 'unknown', 
    xwangItem.title || 'unknown'
  );
  
  // 检查路径是否存在
  if (fs.existsSync(charTitlePath)) {
    return path.join(charTitlePath, filename);
  }
  
  // 如果都不存在，返回null
  return null;
};

/**
 * 获取cosergirl的实际文件路径（支持多root）
 */
const getCosergirlFilePath = (cosergirlItem, filename) => {
  // 获取root配置，默认为0
  const rootId = cosergirlItem.root || 0;
  const pathConfig = getPathConfigById(rootId);
  
  if (!pathConfig || !cosergirlItem.path) {
    return null;
  }
  
  const fullPath = path.join(pathConfig.path, cosergirlItem.path, filename);
  
  // 检查路径是否存在
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  
  return null;
};

/**
 * 根据origin和root获取文件路径
 */
const getFilePathByOrigin = (origin, rootId, relativePath, filename) => {
  const pathConfig = getPathConfigById(rootId);
  
  if (!pathConfig || pathConfig.origin !== origin) {
    return null;
  }
  
  const fullPath = path.join(pathConfig.path, relativePath, filename);
  
  // 检查路径是否存在
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  
  return null;
};

module.exports = {
  getXwangFilePath,
  getCosergirlFilePath,
  getFilePathByOrigin
};