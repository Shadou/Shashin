const path = require('path');
const fs = require('fs');

/**
 * 静态文件服务中间件 - 处理带空格的路径
 */
exports.staticWithSpaces = (basePath) => {
  return (req, res, next) => {
    try {
      // 获取请求路径
      const requestPath = req.path;
      
      if (!requestPath || requestPath === '/') {
        return res.status(400).json({
          success: false,
          message: '需要指定文件路径'
        });
      }
      
      // 解码路径（处理URL编码）
      const decodedPath = decodeURIComponent(requestPath);
      
      // 安全检查：防止目录遍历攻击
      const normalizedPath = path.normalize(decodedPath);
      if (normalizedPath.includes('..')) {
        return res.status(400).json({
          success: false,
          message: '无效的文件路径'
        });
      }
      
      // 构建完整文件路径
      const fullPath = path.join(basePath, normalizedPath);
      
      // 检查文件是否存在
      fs.access(fullPath, fs.constants.F_OK, (err) => {
        if (err) {
          console.log(`文件不存在: ${fullPath}`);
          return res.status(404).json({
            success: false,
            message: '文件不存在',
            requested: requestPath,
            fullPath: fullPath
          });
        }
        
        // 获取文件扩展名
        const ext = path.extname(fullPath).toLowerCase();
        
        // 根据文件类型设置Content-Type
        // 根据文件类型设置Content-Type
        const mimeTypes = {
          // 图片类型 (基于统计中出现的)
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.heic': 'image/heic',
          '.jfif': 'image/jpeg',
          '.jpg_exiftool_tmp': 'application/octet-stream',
          
          // 视频类型 (基于统计中出现的)
          '.mp4': 'video/mp4',
          '.avi': 'video/x-msvideo',
          '.mov': 'video/quicktime',
          '.m4v': 'video/x-m4v',
          
          // 文档类型 (基于统计中出现的)
          '.pdf': 'application/pdf',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          
          // 音频类型 (基于统计中出现的)
          '.mp3': 'audio/mpeg',
          '.wav': 'audio/wav',
          '.m4a': 'audio/mp4'
        };

        // 注意：对于未知类型如 .jpg_exiftool_tmp，可以使用默认的二进制流类型
        // 可以添加：'.jpg_exiftool_tmp': 'application/octet-stream'
                
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        
        // 发送文件
        res.sendFile(fullPath);
      });
    } catch (error) {
      console.error('静态文件服务错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误'
      });
    }
  };
};

/**
 * 调试接口：查看cosergirl路径
 */
exports.debugCosergirlPath = async (req, res) => {
  try {
    // 从req.debugPath获取路径
    const dirPath = req.debugPath || '';
    const basePath = process.env.COSERGIRL_STATIC_PATH || 'F:/cosergirl';
    
    // 解码路径
    const decodedPath = decodeURIComponent(dirPath);
    const fullPath = path.join(basePath, decodedPath);
    
    // 检查路径是否存在
    const exists = fs.existsSync(fullPath);
    let info = {};
    
    if (exists) {
      const stats = fs.statSync(fullPath);
      info = {
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
      
      if (stats.isDirectory()) {
        const files = fs.readdirSync(fullPath);
        info.files = files
          .filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.mp4', '.avi', '.mov'].includes(ext);
          })
          .slice(0, 20);
      }
    }
    
    res.json({
      success: true,
      requested: dirPath,
      decoded: decodedPath,
      fullPath: fullPath,
      exists: exists,
      info: info,
      basePath: basePath
    });
  } catch (error) {
    console.error('调试cosergirl路径错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误',
      error: error.message
    });
  }
};

/**
 * 列出cosergirl目录
 */
exports.listCosergirlDir = async (req, res) => {
  try {
    const { subpath = '' } = req.query;
    const basePath = process.env.COSERGIRL_STATIC_PATH || 'F:/cosergirl';
    
    // 解码路径
    const decodedPath = decodeURIComponent(subpath);
    const fullPath = path.join(basePath, decodedPath);
    
    // 检查路径是否存在且是目录
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return res.status(404).json({
        success: false,
        message: '目录不存在'
      });
    }
    
    // 读取目录
    const items = fs.readdirSync(fullPath);
    const result = items.map(item => {
      const itemPath = path.join(fullPath, item);
      const stats = fs.statSync(itemPath);
      
      return {
        name: item,
        path: path.join(decodedPath, item).replace(/\\/g, '/'),
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        modified: stats.mtime
      };
    });
    
    // 排序：目录在前，文件在后
    result.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    res.json({
      success: true,
      currentPath: decodedPath,
      items: result,
      count: result.length
    });
  } catch (error) {
    console.error('列出cosergirl目录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
};