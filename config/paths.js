// config/paths.js
const all_paths = [{
    'id': 0,
    'path': 'F:\\cosergirl',
    'origin': 'cosergirl'
}, {
    'id': 1,
    'path': '\\\\10.171.199.87\\外接存储-hsh721414aln6m0\\cosergirl',
    'origin': 'cosergirl'
}, {
    'id': 2,
    'path': 'F:\\91xiezhen',
    'origin': '91xiezhen'
}, {
    'id': 3,
    'path': 'F:\\theaic',
    'origin': 'theaic'
}, {
    'id': 4,
    'path': 'F:\\amlyu',
    'origin': 'amlyu'
}]


// 根据ID获取路径配置
function getPathConfigById(id) {
  return all_paths.find(item => item.id === parseInt(id));
}

// 根据origin获取路径配置列表
function getPathConfigsByOrigin(origin) {
  return all_paths.filter(item => item.origin === origin);
}

// 获取默认路径（第一个）
function getDefaultPath(origin) {
  const configs = getPathConfigsByOrigin(origin);
  return configs.length > 0 ? configs[0].path : null;
}

module.exports = {
  all_paths,
  getPathConfigById,
  getPathConfigsByOrigin,
  getDefaultPath
};