// utils/imageProcessor.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const thumbnailConfig = require('../config/thumbnailConfig');

class ImageProcessor {
  constructor() {
    this.cacheDir = process.env.THUMB_CACHE_DIR || path.join(__dirname, '..', 'cache', 'thumbnails');
    this.ensureCacheDir();
    this.processing = new Map(); // 用于避免重复处理同一个文件
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log(`缩略图缓存目录创建: ${this.cacheDir}`);
    }
  }

  /**
   * 获取缩略图文件名
   */
  getThumbnailName(filePath, options = {}) {
    const stats = fs.statSync(filePath);
    const fileInfo = `${filePath}-${stats.mtimeMs}-${stats.size}-${JSON.stringify(options)}`;
    const fileHash = crypto.createHash('md5').update(fileInfo).digest('hex');
    const ext = path.extname(filePath);
    return `${fileHash}${ext}`;
  }

  /**
   * 获取缩略图完整路径
   */
  getThumbnailPath(filePath, options = {}) {
    const thumbName = this.getThumbnailName(filePath, options);
    
    // 使用前2个字符作为目录名，避免单个目录文件过多
    const subDir = thumbName.substring(0, 2);
    const thumbDir = path.join(this.cacheDir, subDir);
    
    if (!fs.existsSync(thumbDir)) {
      fs.mkdirSync(thumbDir, { recursive: true });
    }
    
    return path.join(thumbDir, thumbName);
  }

  // utils/imageProcessor.js - 进一步提高默认选项
async createThumbnail(filePath, options = {}) {
  const cacheKey = `${filePath}-${JSON.stringify(options)}`;
  
  // 如果已经在处理中，等待处理完成
  if (this.processing.has(cacheKey)) {
    console.log(`文件正在处理中: ${filePath}`);
    return this.processing.get(cacheKey);
  }

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    return Promise.resolve(null);
  }

  // 检查是否需要生成缩略图
  if (!this.shouldCreateThumbnail(filePath, options)) {
    console.log(`文件较小，直接返回原图: ${filePath}`);
    return Promise.resolve(filePath);
  }

  const thumbPath = this.getThumbnailPath(filePath, options);
  
  // 如果缩略图已存在，直接返回路径
  if (fs.existsSync(thumbPath)) {
    return Promise.resolve(thumbPath);
  }

  const defaultOptions = {
    ...thumbnailConfig.defaults.detail,
    fit: 'inside',
    withoutEnlargement: true,
  };

  // 合并用户选项
  const config = { ...defaultOptions, ...options };
  
  // 根据文件格式应用特定配置
  const ext = path.extname(filePath).toLowerCase();
  if (thumbnailConfig.formatSpecific[ext]) {
    Object.assign(config, thumbnailConfig.formatSpecific[ext]);
  }
  
  console.log(`开始生成缩略图: ${filePath}, 配置: ${JSON.stringify(config)}`);
  
  // 创建处理 Promise
  const processPromise = (async () => {
    try {
      // 读取原始图片信息
      const metadata = await sharp(filePath).metadata();
      
      console.log(`原图信息: ${metadata.width}x${metadata.height}, 格式: ${metadata.format}, 大小: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)}MB`);
      
      // 如果原始图片小于缩略图尺寸，直接复制
      if (metadata.width <= config.width && metadata.height <= config.height) {
        console.log(`原图尺寸较小，直接复制: ${metadata.width}x${metadata.height} <= ${config.width}x${config.height}`);
        await fs.promises.copyFile(filePath, thumbPath);
        return thumbPath;
      }

      // 创建sharp实例
      let sharpInstance = sharp(filePath);
      
      // 应用格式特定的选项
      const formatOptions = {};
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.jpg' || ext === '.jpeg') {
        formatOptions.jpeg = {
          quality: config.quality,
          mozjpeg: config.mozjpeg || true,
          chromaSubsampling: config.chromaSubsampling || '4:4:4',
          trellisQuantisation: config.trellisQuantisation || true,
          overshootDeringing: config.overshootDeringing || true,
          optimiseScans: config.optimiseScans || true
        };
      } else if (ext === '.png') {
        formatOptions.png = {
          quality: config.quality,
          compressionLevel: config.compressionLevel || 9,
          progressive: config.progressive || true,
          palette: config.palette || true
        };
      } else if (ext === '.webp') {
        formatOptions.webp = {
          quality: config.quality,
          lossless: config.lossless || false,
          nearLossless: config.nearLossless || true,
          alphaQuality: config.alphaQuality || 100
        };
      } else if (ext === '.tiff' || ext === '.tif') {
        formatOptions.tiff = {
          quality: config.quality,
          compression: config.compression || 'jpeg',
          predictor: config.predictor || 'horizontal',
          pyramid: config.pyramid || false,
          tile: config.tile || false
        };
      } else if (ext === '.gif') {
        formatOptions.gif = {};
      }
      
      // 应用格式选项
      Object.keys(formatOptions).forEach(key => {
        if (formatOptions[key]) {
          sharpInstance = sharpInstance[key](formatOptions[key]);
        }
      });
      
      // 构建resize配置
      const resizeConfig = {
        width: config.width,
        height: config.height,
        fit: config.fit,
        withoutEnlargement: config.withoutEnlargement
      };
      
      // 使用配置的插值算法
      if (thumbnailConfig.performance.useLanczosKernel) {
        resizeConfig.kernel = 'lanczos3';
      }
      
      // 调整尺寸
      sharpInstance = sharpInstance.resize(resizeConfig);
      
      // 应用锐化
      if (config.sharpen && thumbnailConfig.performance.autoSharpen) {
        sharpInstance = sharpInstance.sharpen(thumbnailConfig.advanced.sharpenOptions);
      }
      
      // 标准化亮度
      if (thumbnailConfig.performance.autoNormalize) {
        sharpInstance = sharpInstance.normalize();
      }
      
      // 处理并保存
      await sharpInstance.toFile(thumbPath);

      // 获取生成的缩略图信息
      const thumbMetadata = await sharp(thumbPath).metadata();
      const thumbSize = fs.statSync(thumbPath).size;
      console.log(`缩略图生成成功: ${thumbPath}, 尺寸: ${thumbMetadata.width}x${thumbMetadata.height}, 大小: ${(thumbSize / 1024 / 1024).toFixed(2)}MB, 压缩比: ${((thumbSize / fs.statSync(filePath).size) * 100).toFixed(1)}%`);
      return thumbPath;
    } catch (error) {
      console.error(`生成缩略图失败: ${filePath}`, error);
      // 如果生成失败，返回原图路径
      return filePath;
    } finally {
      // 从处理中移除
      this.processing.delete(cacheKey);
    }
  })();

  // 保存处理 Promise
  this.processing.set(cacheKey, processPromise);
  
  return processPromise;
}

// 修改 shouldCreateThumbnail 方法
shouldCreateThumbnail(filePath, options = {}) {
  // 检查文件是否为图片
  const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.tif'];
  const ext = path.extname(filePath).toLowerCase();
  
  if (!imageExts.includes(ext)) {
    return false;
  }

  try {
    // 检查文件大小（大于300KB才生成缩略图）
    const stats = fs.statSync(filePath);
    const minSize = options.minSize || 300 * 1024; // 300KB
    
    // 如果是TIFF格式，总是生成缩略图（因为TIFF通常很大）
    if (ext === '.tiff' || ext === '.tif') {
      return true;
    }
    
    return stats.size > minSize;
  } catch (error) {
    return false;
  }
}

  /**
   * 清理过期缓存（可定期调用）
   */
  async cleanupCache(daysToKeep = 7) {
    try {
      const now = Date.now();
      const cutoff = now - (daysToKeep * 24 * 60 * 60 * 1000);
      let deletedCount = 0;

      const deleteOldFiles = (dir) => {
        if (!fs.existsSync(dir)) return;
        
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stats = fs.statSync(fullPath);
          
          if (stats.isDirectory()) {
            deleteOldFiles(fullPath);
            // 删除空目录
            if (fs.readdirSync(fullPath).length === 0) {
              fs.rmdirSync(fullPath);
            }
          } else if (stats.mtimeMs < cutoff) {
            fs.unlinkSync(fullPath);
            deletedCount++;
          }
        }
      };

      deleteOldFiles(this.cacheDir);
      console.log(`清理缓存完成，删除了 ${deletedCount} 个文件`);
      return deletedCount;
    } catch (error) {
      console.error('清理缓存失败:', error);
      return 0;
    }
  }
}

// 创建单例
module.exports = new ImageProcessor();