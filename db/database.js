const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'faq.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'support')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL DEFAULT '',
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS faq_tags (
    faq_id INTEGER NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (faq_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    faq_id INTEGER NOT NULL REFERENCES faqs(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

(function migrateUsersRoleSupport() {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!row || !row.sql || row.sql.includes('support')) return;
  db.exec(`
    CREATE TABLE users_migrate_support (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user', 'support')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO users_migrate_support SELECT * FROM users;
    DROP TABLE users;
    ALTER TABLE users_migrate_support RENAME TO users;
  `);
})();

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK(kind IN ('staff', 'customer', 'guest')),
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed admin user
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('user1', bcrypt.hashSync('user123', 10), 'user');
}

// Seed other data
const count = db.prepare('SELECT COUNT(*) as c FROM products').get();
if (count.c === 0) {
  const insProduct = db.prepare('INSERT INTO products (name, description) VALUES (?, ?)');
  const insCategory = db.prepare('INSERT INTO categories (name, parent_id, product_id, description) VALUES (?, ?, ?, ?)');
  const insTag = db.prepare('INSERT INTO tags (name) VALUES (?)');
  const insFaq = db.prepare('INSERT INTO faqs (title, question, answer, product_id, category_id) VALUES (?, ?, ?, ?, ?)');
  const insFaqTag = db.prepare('INSERT INTO faq_tags (faq_id, tag_id) VALUES (?, ?)');

  const seed = db.transaction(() => {
    insProduct.run('CloudDesk 云桌面', '云桌面产品的常见问题和解决方案');
    insProduct.run('DataFlow 数据平台', '数据采集、处理、分析平台相关问题');
    insProduct.run('APIGate 网关', 'API 网关产品的配置和故障排查');

    insCategory.run('安装部署', null, 1, 'CloudDesk 安装部署相关');
    insCategory.run('常见问题', null, 1, 'CloudDesk 日常使用问题');
    insCategory.run('故障排查', null, 1, 'CloudDesk 故障处理');
    insCategory.run('安装部署', null, 2, 'DataFlow 安装部署');
    insCategory.run('数据对接', null, 2, 'DataFlow 数据对接问题');
    insCategory.run('配置管理', null, 3, 'APIGate 配置相关');
    insCategory.run('故障排查', null, 3, 'APIGate 故障排查');

    insTag.run('常见');
    insTag.run('紧急');
    insTag.run('已解决');
    insTag.run('待确认');
    insTag.run('视频教程');
    insTag.run('文档');

    insFaq.run(
      'CloudDesk 客户端安装失败怎么办？',
      '安装 CloudDesk 客户端时提示缺少依赖或安装失败',
      '## 问题现象\n\n安装过程中提示 "缺少 Visual C++ 运行库" 或程序无响应。\n\n## 解决方法\n\n1. 下载并安装 [VC++ 运行库](https://aka.ms/vs/17/release/vc_redist.x64.exe)\n2. 以管理员身份运行安装程序\n3. 关闭杀毒软件后重试\n\n## 验证\n\n安装完成后，在命令行执行 `clouddesk --version` 确认版本号。',
      1, 1
    );
    insFaq.run(
      'CloudDesk 连接服务器超时',
      '登录 CloudDesk 后提示"连接服务器超时"',
      '## 排查步骤\n\n1. **检查网络**: ping 服务器地址确认可达\n2. **检查端口**: 确认 8443 端口未被防火墙拦截\n3. **检查服务**: 在服务器上执行 `systemctl status clouddesk-gateway`\n4. **查看日志**: `tail -f /var/log/clouddesk/gateway.log`\n\n![网络拓扑](https://placehold.co/600x300?text=Network+Topology)',
      1, 3
    );
    insFaq.run(
      'DataFlow 数据源连接配置',
      '如何配置 DataFlow 连接 MySQL 数据源',
      '## 配置步骤\n\n1. 登录 DataFlow 管理后台\n2. 进入「数据源管理」→「新建数据源」\n3. 选择 MySQL，填写连接信息:\n   - 主机: `db.example.com`\n   - 端口: `3306`\n   - 数据库: `analytics`\n4. 点击「测试连接」，确认成功后保存\n\n> 确保数据库已开放远程访问权限',
      2, 4
    );
    insFaq.run(
      'APIGate 限流配置不生效',
      '配置了限流规则但请求没有被限制',
      '## 排查思路\n\n1. 确认限流插件已启用: `apigate plugin list | grep rate-limit`\n2. 检查配置是否应用到正确的路由\n3. 查看限流计数器: `redis-cli KEYS "rate:*"`\n4. 确认限流维度配置正确（IP / User / API Key）\n\n```yaml\n# 限流配置示例\nrate_limit:\n  enabled: true\n  strategy: sliding_window\n  limit: 100/min\n  key: $remote_addr\n```',
      3, 6
    );

    insFaqTag.run(1, 1); insFaqTag.run(1, 3);
    insFaqTag.run(2, 1); insFaqTag.run(2, 4);
    insFaqTag.run(3, 1); insFaqTag.run(3, 6);
    insFaqTag.run(4, 2); insFaqTag.run(4, 4);
  });
  seed();
}

module.exports = db;
