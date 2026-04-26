// Keyword-to-category mapping rules
const categoryRules = [
  { keywords: ['安装', '部署', '搭建', 'docker', 'k8s', 'kubernetes', '容器', 'nginx', 'tomcat'], category: '运维部署' },
  { keywords: ['登录', '密码', '账号', '账户', '权限', '认证', '鉴权', 'oauth', 'sso', 'token'], category: '账号权限' },
  { keywords: ['报错', '错误', '异常', '故障', '崩溃', '超时', '502', '500', '404', '无法', '失败', 'error', 'crash', 'bug'], category: '故障排查' },
  { keywords: ['配置', '设置', '参数', 'config', '环境变量', '属性', 'properties', 'yml', 'yaml', 'json'], category: '系统配置' },
  { keywords: ['接口', 'api', '对接', '集成', '回调', 'webhook', 'rest', 'http', '请求', '响应'], category: '接口集成' },
];

// Keyword-to-tag mapping rules
const tagRules = [
  { keywords: ['紧急', '严重', '宕机', '挂掉', '不可用'], tag: '紧急' },
  { keywords: ['常见', 'faq', '经常', '频繁'], tag: '常见' },
];

// File extension / name keyword rules for category suggestion
const fileCategoryRules = [
  { keywords: ['error', 'log', 'crash', 'dump', 'trace', 'stack'], category: '故障排查' },
  { keywords: ['config', 'setting', 'conf', 'cfg', 'properties', 'env', 'yml', 'yaml'], category: '系统配置' },
  { keywords: ['deploy', 'docker', 'nginx', 'k8s', 'compose'], category: '运维部署' },
  { keywords: ['auth', 'login', 'user', 'account', 'passwd'], category: '账号权限' },
  { keywords: ['api', 'sdk', 'client', 'request', 'response', '接口'], category: '接口集成' },
];

function matchRules(text, rules) {
  const lower = text.toLowerCase();
  const matches = [];
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matches.push({ ...rule, matchedKeyword: kw });
        break;
      }
    }
  }
  return matches;
}

/**
 * Suggest categories and tags based on FAQ content
 */
function suggestFromContent(title, question) {
  const text = [title, question].filter(Boolean).join(' ');
  const catMatches = matchRules(text, categoryRules);
  const tagMatches = matchRules(text, tagRules);

  return {
    categories: [...new Set(catMatches.map(r => r.category))],
    tags: [...new Set(tagMatches.map(r => r.tag))],
    details: {
      categories: catMatches.map(r => ({ category: r.category, matchedKeyword: r.matchedKeyword })),
      tags: tagMatches.map(r => ({ tag: r.tag, matchedKeyword: r.matchedKeyword })),
    },
  };
}

/**
 * Suggest category based on filename
 */
function suggestFromFilename(filename) {
  const catMatches = matchRules(filename, fileCategoryRules);
  const tagMatches = matchRules(filename, tagRules);

  const isDoc = /\.(pdf|doc|docx|md|txt|rst)$/i.test(filename);
  const suggestedTags = [...new Set(tagMatches.map(r => r.tag))];
  if (isDoc) suggestedTags.push('文档');

  return {
    categories: [...new Set(catMatches.map(r => r.category))],
    tags: suggestedTags,
  };
}

module.exports = { suggestFromContent, suggestFromFilename };
