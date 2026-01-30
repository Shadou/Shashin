const mongoose = require('mongoose');

const characterSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  id: Number,
  name: String,
  names_like: [String],
  age_rating: Number,
  tags: [String],
  star: { type: Number, default: 0 },
  created_at: String,
  updated_at: String,
  _created_at: Number
}, {
  timestamps: false,
  collection: 'character'
});

// 添加索引以优化搜索
characterSchema.index({ name: 'text', names_like: 'text' });

// 添加索引以提高查询性能
characterSchema.index({ star: 1 });
characterSchema.index({ age_rating: 1 });
characterSchema.index({ name: 1 });

module.exports = mongoose.model('Character', characterSchema);