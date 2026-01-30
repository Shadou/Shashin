require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

// 导入配置和中间件
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const rateLimiter = require('./middleware/rateLimiter');
const logger = require('./utils/logger');
// server.js - 修改 createStaticFileHandler 函数
const imageProcessor = require('./utils/imageProcessor');
const { 
  all_paths, 
  getPathConfigById, 
  getPathConfigsByOrigin 
} = require('./config/paths');

// 导入路由
const xwangRoutes = require('./routes/xwangRoutes');
const cosergirlRoutes = require('./routes/cosergirlRoutes');
const characterRoutes = require('./routes/characterRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保日志目录存在
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// 中间件
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 应用级速率限制
app.use(rateLimiter);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '服务正常运行',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    paths: all_paths
  });
});

// 检查所有静态文件目录是否存在
all_paths.forEach(pathConfig => {
  if (!fs.existsSync(pathConfig.path)) {
    logger.warn(`路径配置 ${pathConfig.id} (${pathConfig.origin}) 目录不存在: ${pathConfig.path}`);
  } else {
    logger.info(`路径配置 ${pathConfig.id} (${pathConfig.origin}) 目录已加载: ${pathConfig.path}`);
  }
});


// server.js - 修改缩略图选项构建部分以支持更高品质
const createStaticFileHandler = (originType) => {
  return async (req, res, next) => {
    try {
      const { 
        root: rootId = '0', 
        thumb, 
        width, 
        height, 
        quality, 
        sharpen,
        ...queryParams 
      } = req.query;
      
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
      
      // 根据root ID获取路径配置
      let pathConfig;
      if (originType === 'specific') {
        // 对于特定origin的路由，使用指定的rootId
        const config = getPathConfigById(parseInt(rootId));
        if (!config) {
          return res.status(404).json({
            success: false,
            message: `未找到ID为${rootId}的路径配置`
          });
        }
        pathConfig = config;
      } else {
        // 对于多origin路由，从路径参数获取origin
        const origin = req.params.origin;
        const configs = getPathConfigsByOrigin(origin);
        if (configs.length === 0) {
          return res.status(404).json({
            success: false,
            message: `未找到origin为${origin}的路径配置`
          });
        }
        // 默认使用第一个配置，或使用指定的rootId
        const configId = req.query.root ? parseInt(req.query.root) : configs[0].id;
        pathConfig = getPathConfigById(configId) || configs[0];
      }
      
      // 构建完整文件路径
      const fullPath = path.join(pathConfig.path, normalizedPath);
      
      // 检查文件是否存在 - 改为使用 Promise
      try {
        await fs.promises.access(fullPath, fs.constants.F_OK);
      } catch (err) {
        console.log(`文件不存在: ${fullPath}`);
        return res.status(404).json({
          success: false,
          message: '文件不存在',
          requested: requestPath,
          fullPath: fullPath,
          pathConfig: pathConfig
        });
      }
      
      // 获取文件扩展名
      const ext = path.extname(fullPath).toLowerCase();
      
      // 图片文件处理逻辑
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif'];
      
      if (imageExtensions.includes(ext)) {
        // 检查是否请求缩略图
        const useThumbnail = thumb === 'true' || thumb === '1' || width || height;
        
        if (useThumbnail) {
          // 构建缩略图选项 - 使用更高的默认值
          const thumbOptions = {};
          
          // 如果未指定尺寸，使用1920x1920作为默认
          if (width && !isNaN(width)) {
            thumbOptions.width = parseInt(width);
          } else {
            thumbOptions.width = 1920; // 默认宽度
          }
          
          if (height && !isNaN(height)) {
            thumbOptions.height = parseInt(height);
          } else {
            thumbOptions.height = 1920; // 默认高度
          }
          
          if (quality && !isNaN(quality)) {
            thumbOptions.quality = Math.min(100, Math.max(50, parseInt(quality))); // 最低质量50
          } else {
            thumbOptions.quality = 95; // 默认质量
          }
          
          // 是否锐化
          if (sharpen === 'true') {
            thumbOptions.sharpen = true;
          }
          
          // 对于TIFF格式，使用更高的质量
          if (ext === '.tiff' || ext === '.tif') {
            thumbOptions.quality = Math.max(thumbOptions.quality, 98);
          }
          
          try {
            // 生成或获取缩略图
            const thumbPath = await imageProcessor.createThumbnail(fullPath, thumbOptions);
            
            // 设置缓存头（缩略图可长期缓存）
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            res.setHeader('X-Image-Type', 'thumbnail');
            res.setHeader('X-Thumbnail-Quality', `${thumbOptions.quality}%`);
            res.setHeader('X-Thumbnail-Dimensions', `${thumbOptions.width}x${thumbOptions.height}`);
            
            // 编码文件路径以避免无效字符
            try {
              const encodedPath = encodeURIComponent(fullPath);
              res.setHeader('X-Original-Path', encodedPath);
            } catch (headerError) {
              console.warn('无法设置X-Original-Path头部:', headerError);
            }
            
            // 发送文件
            return res.sendFile(thumbPath);
          } catch (thumbError) {
            console.error('生成缩略图失败，返回原图:', thumbError);
            // 缩略图生成失败，返回原图
          }
        }
        
        // 原图：设置适当的缓存头
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1小时
        res.setHeader('X-Image-Type', 'original');
      }
      
      // 非图片文件或不需要缩略图的图片：设置 Content-Type 并发送文件
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff',
        
        // 视频格式
        '.mp4': 'video/mp4',
        '.avi': 'video/x-msvideo',
        '.mov': 'video/quicktime',
        '.wmv': 'video/x-ms-wmv',
        '.flv': 'video/x-flv',
        '.mkv': 'video/x-matroska',
        '.m4v': 'video/x-m4v',
        '.mpg': 'video/mpeg',
        '.mpeg': 'video/mpeg',
        '.3gp': 'video/3gpp',
        '.webm': 'video/webm',
        
        '.pdf': 'application/pdf'
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      
      // 发送文件
      res.sendFile(fullPath);
      
    } catch (error) {
      console.error('静态文件服务错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器错误'
      });
    }
  };
};

// 1. 兼容旧的cosergirl静态文件服务（默认使用id=0的配置）
app.use('/api/files/cosergirl', createStaticFileHandler('specific'));

// 2. 新的多origin静态文件服务
app.use('/api/files/origin/:origin', createStaticFileHandler('multi'));

// 3. xwang静态文件服务（保持不变，直接使用express.static）
const xwangStaticPath = process.env.XWANG_STATIC_PATH || 'D:/Files/xwang';
app.use('/api/files/xwang', (req, res, next) => {
  const requestedPath = path.normalize(req.path);
  if (requestedPath.includes('..')) {
    return res.status(400).json({
      success: false,
      message: '无效的文件路径'
    });
  }
  next();
}, express.static(xwangStaticPath));

// API路由
app.use('/api/xwang', xwangRoutes);
app.use('/api/cosergirl', cosergirlRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/admin', adminRoutes);

// 获取所有路径配置
app.get('/api/config/paths', (req, res) => {
  res.json({
    success: true,
    data: all_paths
  });
});

// 根据ID获取路径配置
app.get('/api/config/paths/:id', (req, res) => {
  const { id } = req.params;
  const config = getPathConfigById(parseInt(id));
  
  if (!config) {
    return res.status(404).json({
      success: false,
      message: `未找到ID为${id}的路径配置`
    });
  }
  
  res.json({
    success: true,
    data: config
  });
});

// 调试接口 - 列出目录内容（支持多origin）
app.get('/api/debug/list-dir', (req, res) => {
  try {
    const { origin, root: rootId = '0', subpath = '' } = req.query;
    
    let pathConfig;
    if (origin) {
      const configs = getPathConfigsByOrigin(origin);
      if (configs.length === 0) {
        return res.status(404).json({
          success: false,
          message: `未找到origin为${origin}的路径配置`
        });
      }
      pathConfig = getPathConfigById(parseInt(rootId)) || configs[0];
    } else {
      // 如果没有指定origin，使用rootId
      pathConfig = getPathConfigById(parseInt(rootId));
      if (!pathConfig) {
        return res.status(404).json({
          success: false,
          message: `未找到ID为${rootId}的路径配置`
        });
      }
    }
    
    // 解码路径
    const decodedPath = decodeURIComponent(subpath);
    const fullPath = path.join(pathConfig.path, decodedPath);
    
    // 检查路径是否存在且是目录
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
      return res.status(404).json({
        success: false,
        message: '目录不存在',
        fullPath: fullPath
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
      pathConfig: pathConfig,
      currentPath: decodedPath,
      fullPath: fullPath,
      items: result,
      count: result.length
    });
  } catch (error) {
    console.error('列出目录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// server.js - 修改代理接口部分
// 代理接口 - 支持多origin - 修改后的版本
app.get('/api/proxy/file', async (req, res) => {
  try {
    const { origin, root: rootId = '0', path: filePath, thumb, width, height, quality } = req.query;
    
    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: '需要文件路径参数'
      });
    }
    
    let pathConfig;
    if (origin) {
      const configs = getPathConfigsByOrigin(origin);
      if (configs.length === 0) {
        return res.status(404).json({
          success: false,
          message: `未找到origin为${origin}的路径配置`
        });
      }
      pathConfig = getPathConfigById(parseInt(rootId)) || configs[0];
    } else {
      // 如果没有指定origin，使用rootId
      pathConfig = getPathConfigById(parseInt(rootId));
      if (!pathConfig) {
        return res.status(404).json({
          success: false,
          message: `未找到ID为${rootId}的路径配置`
        });
      }
    }
    
    // 解码路径
    const decodedPath = decodeURIComponent(filePath);
    const fullPath = path.join(pathConfig.path, decodedPath);
    
    // 安全检查
    const normalized = path.normalize(fullPath);
    if (normalized.includes('..')) {
      return res.status(400).json({
        success: false,
        message: '无效的文件路径'
      });
    }
    
    // 检查文件是否存在
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: '文件不存在',
        path: filePath,
        decodedPath: decodedPath,
        fullPath: fullPath
      });
    }
    
    // 获取文件扩展名
    const ext = path.extname(fullPath).toLowerCase();
    
    // 图片文件处理逻辑
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    
    if (imageExtensions.includes(ext)) {
      // 检查是否请求缩略图
      const useThumbnail = thumb === 'true' || thumb === '1' || width || height;
      
      if (useThumbnail) {
        // 构建缩略图选项
        const thumbOptions = {};
        
        if (width && !isNaN(width)) {
          thumbOptions.width = parseInt(width);
        }
        
        if (height && !isNaN(height)) {
          thumbOptions.height = parseInt(height);
        }
        
        if (quality && !isNaN(quality)) {
          thumbOptions.quality = Math.min(100, Math.max(10, parseInt(quality)));
        }
        
        try {
          // 生成或获取缩略图
          const thumbPath = await imageProcessor.createThumbnail(fullPath, thumbOptions);
          
          // 设置缓存头
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          res.setHeader('X-Image-Type', 'thumbnail');
          
          // 编码文件路径以避免无效字符
          try {
            const encodedPath = encodeURIComponent(fullPath);
            res.setHeader('X-Original-Path', encodedPath);
          } catch (headerError) {
            console.warn('无法设置X-Original-Path头部:', headerError);
          }
          
          // 发送文件
          return res.sendFile(thumbPath);
        } catch (thumbError) {
          console.error('生成缩略图失败，返回原图:', thumbError);
          // 缩略图生成失败，返回原图
        }
      }
      
      // 原图：设置适当的缓存头
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Image-Type', 'original');
    }
    
    // 发送文件
    res.sendFile(fullPath);
  } catch (error) {
    console.error('代理文件错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// server.js - 修改通过数据库记录ID获取文件的接口
// 通过数据库记录ID获取文件 - 修改后的版本
app.get('/api/images/:origin/:id', async (req, res) => {
  try {
    const { origin, id } = req.params;
    const { filename, thumb, width, height, quality } = req.query;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: '需要filename参数'
      });
    }
    
    // 解码文件名
    const decodedFilename = decodeURIComponent(filename);
    
    // 根据origin动态导入模型
    let Model;
    switch (origin) {
      case 'cosergirl':
        Model = require('./models/Cosergirl');
        break;
      case '91xiezhen':
        Model = require('./models/Xiezhen91');
        break;
      case 'theaic':
        Model = require('./models/Theaic');
        break;
      default:
        return res.status(400).json({
          success: false,
          message: '不支持的origin类型'
        });
    }
    
    const item = await Model.findById(id);
    
    if (!item || !item.path) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    // 根据记录的root字段获取路径配置
    const rootId = item.root || 0;
    const pathConfig = getPathConfigById(rootId);
    
    if (!pathConfig) {
      return res.status(404).json({
        success: false,
        message: '路径配置不存在'
      });
    }
    
    const fullPath = path.join(pathConfig.path, item.path, decodedFilename);
    
    // 安全检查
    const normalized = path.normalize(fullPath);
    if (normalized.includes('..')) {
      return res.status(400).json({
        success: false,
        message: '无效的文件路径'
      });
    }
    
    // 检查文件是否存在
    try {
      await fs.promises.access(fullPath, fs.constants.F_OK);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: '文件不存在',
        path: fullPath
      });
    }
    
    // 获取文件扩展名
    const ext = path.extname(fullPath).toLowerCase();
    
    // 图片文件处理逻辑
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    
    if (imageExtensions.includes(ext)) {
      // 检查是否请求缩略图
      const useThumbnail = thumb === 'true' || thumb === '1' || width || height;
      
      if (useThumbnail) {
        // 构建缩略图选项
        const thumbOptions = {};
        
        if (width && !isNaN(width)) {
          thumbOptions.width = parseInt(width);
        }
        
        if (height && !isNaN(height)) {
          thumbOptions.height = parseInt(height);
        }
        
        if (quality && !isNaN(quality)) {
          thumbOptions.quality = Math.min(100, Math.max(10, parseInt(quality)));
        }
        
        try {
          // 生成或获取缩略图
          const thumbPath = await imageProcessor.createThumbnail(fullPath, thumbOptions);
          
          // 设置缓存头
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          res.setHeader('X-Image-Type', 'thumbnail');
          
          // 编码文件路径以避免无效字符
          try {
            const encodedPath = encodeURIComponent(fullPath);
            res.setHeader('X-Original-Path', encodedPath);
          } catch (headerError) {
            console.warn('无法设置X-Original-Path头部:', headerError);
          }
          
          // 发送文件
          return res.sendFile(thumbPath);
        } catch (thumbError) {
          console.error('生成缩略图失败，返回原图:', thumbError);
          // 缩略图生成失败，返回原图
        }
      }
      
      // 原图：设置适当的缓存头
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Image-Type', 'original');
    }
    
    res.sendFile(fullPath);
  } catch (error) {
    console.error('通过ID获取文件错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 清理缩略图缓存接口
app.get('/api/admin/cleanup-thumbnails', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const deletedCount = await imageProcessor.cleanupCache(parseInt(days));
    
    res.json({
      success: true,
      message: `清理完成，删除了 ${deletedCount} 个过期缩略图`,
      deletedCount
    });
  } catch (error) {
    console.error('清理缓存错误:', error);
    res.status(500).json({
      success: false,
      message: '清理缓存失败',
      error: error.message
    });
  }
});

// 获取缓存统计信息
app.get('/api/admin/thumbnail-stats', (req, res) => {
  try {
    const cacheDir = imageProcessor.cacheDir;
    
    let totalFiles = 0;
    let totalSize = 0;
    
    const calculateSize = (dir) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          calculateSize(fullPath);
        } else {
          totalFiles++;
          totalSize += stats.size;
        }
      }
    };
    
    calculateSize(cacheDir);
    
    res.json({
      success: true,
      data: {
        cacheDir,
        totalFiles,
        totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
        processingCount: imageProcessor.processing.size
      }
    });
  } catch (error) {
    console.error('获取缓存统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败',
      error: error.message
    });
  }
});

// 处理根路径
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Coser Gallery API',
    version: '2.0.0',
    endpoints: {
      health: '/api/health',
      xwang: '/api/xwang',
      cosergirl: '/api/cosergirl',
      characters: '/api/characters',
      files: {
        xwang: '/api/files/xwang/{xid}/{filename}',
        cosergirl: '/api/files/cosergirl/{encoded-path}?root={rootId}',
        origin_based: '/api/files/origin/{origin}/{encoded-path}?root={rootId}'
      },
      proxy: '/api/proxy/file?origin={origin}&root={rootId}&path={encoded-full-path}',
      images: '/api/images/{origin}/{id}?filename={filename}',
      config: {
        paths: '/api/config/paths',
        path_by_id: '/api/config/paths/{id}'
      },
      debug: {
        list_dir: '/api/debug/list-dir?origin={origin}&root={rootId}&subpath={encoded-path}'
      }
    }
  });
});

// 处理404
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      message: 'API端点不存在'
    });
  }
  res.status(404).json({
    success: false,
    message: '请求的资源不存在'
  });
});

// 错误处理中间件
app.use(errorHandler);

// 启动服务器
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      logger.info(`服务器运行在端口 ${PORT}`);
      logger.info(`环境: ${process.env.NODE_ENV}`);
      logger.info(`访问地址: http://localhost:${PORT}`);
      logger.info('已加载的路径配置:');
      all_paths.forEach(pathConfig => {
        logger.info(`  [${pathConfig.id}] ${pathConfig.origin}: ${pathConfig.path}`);
      });
      logger.info('示例URL:');
      logger.info('  - cosergirl文件 (默认root=0): /api/files/cosergirl/d052.0-kurumi/Kurumi%20NO.003%20%E3%83%9B%E3%82%B7%E3%83%8E%E6%B0%B4%E7%9D%80%20%5B18P-46MB%5D/001.jpg');
      logger.info('  - cosergirl文件 (指定root=1): /api/files/cosergirl/d052.0-kurumi/Kurumi%20NO.003%20%E3%83%9B%E3%82%B7%E3%83%8E%E6%B0%B4%E7%9D%80%20%5B18P-46MB%5D/001.jpg?root=1');
      logger.info('  - 多origin文件: /api/files/origin/91xiezhen/some-path/image.jpg?root=2');
      logger.info('  - 代理接口: /api/proxy/file?origin=cosergirl&root=1&path=d052.0-kurumi%2FKurumi%20NO.003%20%E3%83%9B%E3%82%B7%E3%83%8E%E6%B0%B4%E7%9D%80%20%5B18P-46MB%5D%2F001.jpg');
    });
  } catch (error) {
    logger.error('启动服务器失败:', error);
    process.exit(1);
  }
};

startServer();

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});