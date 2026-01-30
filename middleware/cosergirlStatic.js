const path = require('path');
const fs = require('fs');
const express = require('express');

/**
 * 创建cosergirl静态文件服务
 */
const createCosergirlStatic = (basePath) => {
  const router = express.Router();
  
  // 处理cosergirl静态文件请求
  router.use('*', (req, res, next) => {
    // 获取请求路径（去掉/api/files/cosergirl前缀）
    const requestPath = req.path;
    
    // 解码URL路径组件（express会自动解码，但为了安全我们显式解码）
    const decodedPath = decodeURIComponent(requestPath);
    
    // 安全检查：防止目录遍历攻击
    const normalizedPath = path.normalize(decodedPath);
    if (normalizedPath.includes('..')) {
      return res.status(400).json({
        success: false,
        message: '无效的文件路径'
      });
    }
    
    // 构建完整的文件系统路径
    const fullPath = path.join(basePath, normalizedPath);
    
    // 检查文件是否存在
    fs.access(fullPath, fs.constants.F_OK, (err) => {
      if (err) {
        // 如果文件不存在，尝试另一种路径格式（处理可能的路径格式问题）
        const altPath = path.join(basePath, ...decodedPath.split('/').map(decodeURIComponent));
        
        fs.access(altPath, fs.constants.F_OK, (altErr) => {
          if (altErr) {
            console.log(`文件不存在: ${fullPath}`);
            return res.status(404).json({
              success: false,
              message: '文件不存在',
              requested: decodedPath,
              fullPath: fullPath
            });
          }
          
          // 使用备选路径
          res.sendFile(altPath);
        });
      } else {
        // 文件存在，发送文件
        res.sendFile(fullPath);
      }
    });
  });
  
  return router;
};

module.exports = createCosergirlStatic;