// utils/imageProcessor.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

  /**
   * 检查是否需要生成缩略图
   */
  shouldCreateThumbnail(filePath, options = {}) {
    // 检查文件是否为图片
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const ext = path.extname(filePath).toLowerCase();
    
    if (!imageExts.includes(ext)) {
      return false;
    }

    // 检查文件大小（大于200KB才生成缩略图）
    try {
      const stats = fs.statSync(filePath);
      return stats.size > 200 * 1024; // 200KB
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成缩略图
   */
  // utils/imageProcessor.js - 添加错误处理
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

  // 设置默认选项
  const defaultOptions = {
    width: 1280,
    height: 1280,
    quality: 90,
    fit: 'inside',
    withoutEnlargement: true,
  };

  const config = { ...defaultOptions, ...options };
  
  console.log(`开始生成缩略图: ${filePath} -> ${thumbPath}`);
  
  // 创建处理 Promise
  const processPromise = (async () => {
    try {
      // 读取原始图片信息
      const metadata = await sharp(filePath).metadata();
      
      // 如果原始图片小于缩略图尺寸，直接复制
      if (metadata.width <= config.width && metadata.height <= config.height) {
        await fs.promises.copyFile(filePath, thumbPath);
        return thumbPath;
      }

      // 创建缩略图
      let sharpInstance = sharp(filePath);
      
      // 根据文件格式选择合适的处理方式
      const ext = path.extname(filePath).toLowerCase();
      
      if (ext === '.gif') {
        // 对于GIF，只处理第一帧
        sharpInstance = sharpInstance.gif();
      } else if (ext === '.png') {
        // 对于PNG，使用PNG压缩
        sharpInstance = sharpInstance.png({ 
          compressionLevel: 9,
          quality: config.quality 
        });
      } else {
        // 默认使用JPEG
        sharpInstance = sharpInstance.jpeg({ 
          quality: config.quality,
          mozjpeg: true 
        });
      }
      
      // 调整尺寸
      await sharpInstance
        .resize({
          width: config.width,
          height: config.height,
          fit: config.fit,
          withoutEnlargement: config.withoutEnlargement,
        })
        .toFile(thumbPath);

      console.log(`缩略图生成成功: ${thumbPath}`);
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