const mongoose = require('mongoose');

const xwangSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  xid: String,
  character: String,
  title: String,
  size: Number,
  count: Number,
  images: [[String, String]], // 注意：示例中是字符串，不是数字
  star: { type: Number, default: 0 },
  created_at: String,
  updated_at: String,
  _created_at: Number,
  _updated_at: Number,
  character_id: Number,
  character_old: String
}, {
  timestamps: false,
  collection: 'xwang'
});

// 添加索引以提高查询性能
xwangSchema.index({ star: 1 });
xwangSchema.index({ character: 1 });
xwangSchema.index({ updated_at: -1 });

// 添加一个方法或虚拟字段来生成文件路径
// 由于不知道xwang的实际目录结构，我们先假设路径是 xid/图片名
xwangSchema.virtual('coverImage').get(function() {
  if (!this.images || this.images.length === 0) return null;
  
  // 尝试从xid构建路径
  if (this.xid) {
    return `/api/files/xwang/${this.xid}/${this.images[0][0]}`;
  }
  
  // 备选方案：从character和title构建
  return `/api/files/xwang/${encodeURIComponent(this.character)}/${encodeURIComponent(this.title)}/${this.images[0][0]}`;
});

xwangSchema.virtual('imagesWithUrls').get(function() {
  if (!this.images) return [];
  
  return this.images.map(img => ({
    filename: img[0],
    size: img[1],
    url: this.xid 
      ? `/api/files/xwang/${this.xid}/${img[0]}`
      : `/api/files/xwang/${encodeURIComponent(this.character)}/${encodeURIComponent(this.title)}/${img[0]}`
  }));
});

xwangSchema.set('toJSON', { virtuals: true });
xwangSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Xwang', xwangSchema);