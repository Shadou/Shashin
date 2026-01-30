// config/thumbnailConfig.js
module.exports = {
  // 默认缩略图配置
  defaults: {
    // 封面图配置
    cover: {
      width: 1200,
      height: 1200,
      quality: 95,
      sharpen: true
    },
    
    // 列表页缩略图配置
    list: {
      width: 600,
      height: 600,
      quality: 90,
      sharpen: true
    },
    
    // 详情页缩略图配置
    detail: {
      width: 1920,
      height: 1920,
      quality: 95,
      sharpen: true
    },
    
    // 超高品质缩略图配置
    highQuality: {
      width: 2560,
      height: 2560,
      quality: 98,
      sharpen: true
    },
    
    // 原图品质（接近无损）
    originalQuality: {
      width: 3840,
      height: 3840,
      quality: 100,
      sharpen: true
    }
  },
  
  // 文件格式特定配置
  formatSpecific: {
    '.jpg': {
      quality: 95,
      chromaSubsampling: '4:4:4',
      mozjpeg: true,
      trellisQuantisation: true,
      overshootDeringing: true,
      optimiseScans: true
    },
    '.jpeg': {
      quality: 95,
      chromaSubsampling: '4:4:4',
      mozjpeg: true,
      trellisQuantisation: true,
      overshootDeringing: true,
      optimiseScans: true
    },
    '.png': {
      quality: 95,
      compressionLevel: 9,
      progressive: true,
      palette: true
    },
    '.webp': {
      quality: 95,
      lossless: false,
      nearLossless: true,
      alphaQuality: 100
    },
    '.tiff': {
      quality: 98,
      compression: 'jpeg',
      predictor: 'horizontal',
      pyramid: false,
      tile: false
    }
  },
  
  // 性能配置
  performance: {
    maxConcurrentProcessing: 3, // 降低并发数以提高质量
    minFileSizeForThumbnail: 300 * 1024, // 300KB以上才生成缩略图
    cacheDays: 60, // 缓存保留天数
    useLanczosKernel: true, // 使用Lanczos插值算法
    autoSharpen: true, // 自动锐化
    autoNormalize: true // 自动标准化亮度
  },
  
  // 高级处理选项
  advanced: {
    // 插值算法选项
    kernelOptions: {
      'nearest': '最近邻（快，质量低）',
      'linear': '线性（平衡）',
      'cubic': '立方（质量好）',
      'mitchell': '米切尔（非常好）',
      'lanczos2': 'Lanczos2（优秀）',
      'lanczos3': 'Lanczos3（最佳质量）'
    },
    
    // 锐化选项
    sharpenOptions: {
      sigma: 0.5,
      flat: 1.0,
      jagged: 2.0
    }
  }
};