/**
 * 构建cosergirl图片URL的工具函数
 */

/**
 * 方法1：使用静态文件服务URL
 * 需要对路径的每一部分单独编码
 */
exports.buildCosergirlStaticUrl = (item, imageFilename) => {
  if (!item.path || !imageFilename) return null;
  
  // 对路径的每一部分进行编码
  const encodedPath = item.path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  
  // 对imageFilename的每一部分也进行编码（特别是当它包含空格时）
  const encodedImageFilename = imageFilename
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  
  return `/api/files/cosergirl/${encodedPath}/${encodedImageFilename}`;
};

/**
 * 方法2：使用代理接口URL
 * 对整个路径编码
 */
exports.buildCosergirlProxyUrl = (item, imageFilename) => {
  if (!item.path || !imageFilename) return null;
  
  // 对完整路径进行编码
  const fullPath = `${item.path}/${imageFilename}`;
  const encodedPath = encodeURIComponent(fullPath);
  
  return `/api/proxy/cosergirl?path=${encodedPath}`;
};

/**
 * 方法3：使用ID接口URL（最可靠）
 */
exports.buildCosergirlImageUrl = (item, imageFilename) => {
  if (!item._id || !imageFilename) return null;
  
  // 对完整文件名进行编码
  const encodedImageFilename = encodeURIComponent(imageFilename);
  
  return `/api/images/cosergirl/${item._id}?filename=${encodedImageFilename}`;
};

/**
 * 构建xwang图片URL
 */
exports.buildXwangImageUrl = (item, imageFilename) => {
  if (!item.xid || !imageFilename) return null;
  
  // 对imageFilename进行编码
  const encodedImageFilename = imageFilename
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
  
  return `/api/files/xwang/${item.xid}/${encodedImageFilename}`;
};

/**
 * 根据数据类型自动构建URL
 */
exports.buildImageUrl = (item, imageFilename, type = 'auto') => {
  if (!item || !imageFilename) return null;
  
  // 判断数据类型
  const isCosergirl = item.path !== undefined;
  const isXwang = item.xid !== undefined;
  
  if (isCosergirl) {
    if (type === 'id' || type === 'auto') {
      return `/api/images/cosergirl/${item._id}/${encodeURIComponent(imageFilename)}`;
    } else if (type === 'static') {
      return exports.buildCosergirlStaticUrl(item, imageFilename);
    } else if (type === 'proxy') {
      return exports.buildCosergirlProxyUrl(item, imageFilename);
    }
  } else if (isXwang) {
    return exports.buildXwangImageUrl(item, imageFilename);
  }
  
  return null;
};