# 产品知识库系统

面向产品和客服团队的知识管理平台，按产品组织常见问题及解决方案，支持富媒体（图片、视频）附件和自动分类。

## 快速启动

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式（文件变更自动重启）
npm run dev
```

访问 `http://localhost:3000`

## 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |
| 普通用户 | user1 | user123 |

## 功能概览

### 产品管理
- 按产品组织知识条目
- 每个产品下可建分类和 FAQ

### FAQ 知识库
- 标题 / 问题描述 / 答案（支持 Markdown）
- 按产品、分类、标签、关键词组合搜索
- 一键复制分享链接

### 富媒体附件
- 图片上传：自动缩略图预览
- 视频上传：自动检测 HEVC 编码并转码为 H.264
- 视频播放：点击展开内嵌播放器，支持进度条、全屏
- 文件下载

### 权限系统
- **管理员**：可管理产品、分类、标签、用户、FAQ 的增删改
- **普通用户**：只读浏览和搜索

### 用户管理
- 管理员可在 Web 界面增删改用户
- 支持重置密码、切换角色

### 自动分类
- 创建 FAQ 时根据标题和问题内容自动建议分类和标签
- 基于关键词匹配规则引擎

## 技术栈

| 层面 | 技术 |
|------|------|
| 框架 | Express.js |
| 数据库 | SQLite (better-sqlite3) |
| 模板 | EJS + express-ejs-layouts |
| 认证 | express-session + bcryptjs |
| 文件上传 | multer |
| 视频转码 | ffmpeg |
| 前端 | 原生 CSS + JavaScript |

## 项目结构

```
├── server.js              # 应用入口
├── db/database.js         # 数据库初始化 & 种子数据
├── middleware/auth.js      # 认证 & 角色中间件
├── routes/
│   ├── auth.js            # 登录/登出
│   ├── users.js           # 用户管理（管理员）
│   ├── products.js        # 产品管理（管理员）
│   ├── categories.js      # 分类管理（管理员）
│   ├── tags.js            # 标签管理（管理员）
│   ├── faqs.js            # FAQ 增删改查 & 文件上传
│   └── files.js           # 文件查看/下载/删除
├── services/
│   ├── classifier.js      # 关键词自动分类引擎
│   └── transcode.js       # 视频 HEVC→H.264 转码
├── views/                 # EJS 模板
│   ├── layout.ejs         # 公共布局（导航栏、脚本）
│   ├── index.ejs          # 首页仪表盘
│   ├── login.ejs          # 登录页
│   ├── faqs.ejs           # FAQ 列表 & 搜索
│   ├── faq-form.ejs       # FAQ 新建/编辑
│   ├── faq-detail.ejs     # FAQ 详情 & 播放器
│   ├── products.ejs       # 产品管理
│   ├── categories.ejs     # 分类管理
│   ├── tags.ejs           # 标签管理
│   ├── users.ejs          # 用户管理
│   └── 403.ejs            # 无权限提示
├── public/style.css       # 全局样式
├── uploads/               # 上传文件目录
└── package.json
```

## 依赖

- Node.js >= 18
- ffmpeg（可选，用于视频自动转码）

```bash
# Ubuntu / Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```
