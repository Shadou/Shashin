
const mongoose = require('mongoose');

const cosergirlSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  character: String,
  title: String,
  path: String,
  count: Number,
  size: Number,
  path: {
    type: String,
    required: true
  },
  root: {
    type: Number,
    default: 0,  // 默认为id=0的路径
    index: true
  },
  images: [[String, String]],  // 嵌套数组
  videos: [[String, String]],  // 修改为嵌套数组，以匹配实际数据
  files: [String],
  metadata: {
    capacity: {
      value: Number,
      unit: String
    },
    no_number: Number,
    type: String,
    count: Number,
    original_name: String
  },
  star: { type: Number, default: 0 },
  created_at: String,
  updated_at: String,
  _created_at: Number,
  _updated_at: Number,
  character_id: Number,
  character_old: String
}, {
  timestamps: false,
  collection: 'cosergirl'
});

// 添加索引以提高查询性能
cosergirlSchema.index({ star: 1 });
cosergirlSchema.index({ character: 1 });
cosergirlSchema.index({ updated_at: -1 });

// 方法1：使用静态文件服务（需要对路径部分单独编码）
cosergirlSchema.virtual('coverImage').get(function() {
  if (!this.images || this.images.length === 0 || !this.path) return null;
  
  // 对路径的每一部分进行编码
  const encodedPath = this.path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  
  return `/api/files/cosergirl/${encodedPath}/${this.images[0][0]}`;
});

// 方法2：使用代理接口（对整个路径编码）
cosergirlSchema.virtual('coverImageProxy').get(function() {
  if (!this.images || this.images.length === 0 || !this.path) return null;
  
  // 对完整路径进行编码
  const fullPath = `${this.path}/${this.images[0][0]}`;
  const encodedPath = encodeURIComponent(fullPath);
  
  return `/api/proxy/cosergirl?path=${encodedPath}`;
});

// 方法3：使用ID接口（最可靠）- 修改为查询参数形式
cosergirlSchema.virtual('coverImageById').get(function() {
  if (!this.images || this.images.length === 0) return null;
  
  // 使用查询参数形式: /api/images/cosergirl/:id?filename=xxx
  return `/api/images/cosergirl/${this._id}?filename=${encodeURIComponent(this.images[0][0])}`;
});

// 添加视频封面（如果有视频但没有图片）- 修改为查询参数形式
cosergirlSchema.virtual('videoCoverImage').get(function() {
  if (this.images && this.images.length > 0) return null;
  if (!this.videos || this.videos.length === 0) return null;
  
  return `/api/images/cosergirl/${this._id}?filename=${encodeURIComponent(this.videos[0][0])}`;
});

// 为图片生成URL - 修改为查询参数形式
cosergirlSchema.virtual('imagesWithUrls').get(function() {
  if (!this.images) return [];
  
  return this.images.map(img => ({
    filename: img[0],
    size: img[1],
    // 使用查询参数形式
    url: `/api/images/cosergirl/${this._id}?filename=${encodeURIComponent(img[0])}`,
    urlStatic: this.path 
      ? `/api/files/cosergirl/${this.path.split('/').map(encodeURIComponent).join('/')}/${img[0]}`
      : null,
    urlProxy: this.path 
      ? `/api/proxy/cosergirl?path=${encodeURIComponent(`${this.path}/${img[0]}`)}`
      : null
  }));
});

// 为视频生成URL - 修改为查询参数形式
cosergirlSchema.virtual('videosWithUrls').get(function() {
  if (!this.videos) return [];
  
  return this.videos.map(video => ({
    filename: video[0],
    size: video[1],
    // 使用查询参数形式
    url: `/api/images/cosergirl/${this._id}?filename=${encodeURIComponent(video[0])}`,
    urlStatic: this.path 
      ? `/api/files/cosergirl/${this.path.split('/').map(encodeURIComponent).join('/')}/${video[0]}`
      : null,
    urlProxy: this.path 
      ? `/api/proxy/cosergirl?path=${encodeURIComponent(`${this.path}/${video[0]}`)}`
      : null
  }));
});

// 获取所有媒体文件（图片+视频）
cosergirlSchema.virtual('allMedia').get(function() {
  const images = this.imagesWithUrls || [];
  const videos = this.videosWithUrls || [];
  return [...images, ...videos];
});

cosergirlSchema.set('toJSON', { virtuals: true });
cosergirlSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Cosergirl', cosergirlSchema);