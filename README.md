# CHEERFUL 项目说明

CHEERFUL 是一个面向建材展示与后台管理的一体化网站项目，包含：

- 前台官网：多语言展示（中文 / 英文 / 斯瓦希里语）
- 管理后台：产品、分类、联系消息、团队成员、公司信息管理
- 后端服务：Node.js + Express + MongoDB
- 文件上传：支持产品图、产品介绍图、团队成员头像上传

## 技术栈

- 前端：HTML + CSS + 原生 JavaScript + Bootstrap 5
- 后端：Node.js（ESM）+ Express
- 数据库：MongoDB
- 上传：Multer

## 目录结构

```text
.
├─ images/                  # 前台静态图片资源
├─ public/                  # 前台/后台页面
│  ├─ index.html            # 前台官网
│  ├─ login.html            # 管理员登录页
│  ├─ admin.html            # 管理后台
│  └─ css/
├─ server/
│  ├─ server.js             # 后端主服务（端口 4000）
│  ├─ package.json
│  └─ uploads/              # 上传文件目录
├─ welink                   # Nginx 参考配置（子域名/反向代理）
└─ README.md
```

## 环境要求

- Node.js 18+
- MongoDB 5+

## 快速启动

### 1. 安装依赖

进入后端目录安装依赖：

```bash
cd server
npm install
```

### 2. 启动 MongoDB

请确保本机 MongoDB 已运行，默认连接地址为：

- mongodb://localhost:27017
- 数据库名：cheerful_db

### 3. 启动服务

```bash
npm run start
```

服务默认运行在：

- http://localhost:4000

## 访问入口

- 前台首页：http://localhost:4000/index.html
- 后台登录：http://localhost:4000/login.html
- 后台管理：http://localhost:4000/admin.html

## 默认初始化数据

首次启动会自动初始化以下数据：

- 默认分类：瓷砖 / 卫浴 / 灯饰
- 默认管理员账号：
  - 用户名：admin
  - 密码：admin
  - 现密码：welink

## 主要功能

- 认证登录
- 分类管理（增删改查）
- 产品管理（增删改查）
  - 多图上传（主图最多 40）
  - 图文介绍图片上传（最多 40）
  - 价格与多语言文案
- 联系消息管理
- 团队成员管理
- 公司信息（中英斯三语）管理
- 统计看板（产品数/分类数/消息数/成员数）

## API 概览

后端接口前缀：/api

- 认证：
  - POST /api/auth/login
- 分类：
  - GET /api/categories
  - GET /api/categories/:id
  - POST /api/categories
  - PUT /api/categories/:id
  - DELETE /api/categories/:id
- 产品：
  - GET /api/products
  - GET /api/products/:id
  - GET /api/categories/:categoryId/products
  - GET /api/search?q=关键词
  - POST /api/products
  - PUT /api/products/:id
  - DELETE /api/products/:id
- 联系消息：
  - GET /api/contacts
  - GET /api/contacts/:id
  - POST /api/contacts
  - PUT /api/contacts/:id
  - DELETE /api/contacts/:id
- 团队成员：
  - GET /api/team-members
  - GET /api/team-members/:id
  - POST /api/team-members
  - PUT /api/team-members/:id
  - DELETE /api/team-members/:id
- 公司信息：
  - GET /api/company-info
  - PUT /api/company-info
- 统计：
  - GET /api/stats

## 上传说明

- 上传目录：server/uploads
- 仅允许图片类型
- 限制：
  - 单文件最大 100MB
  - 单次最多 80 个文件（主图 + 介绍图）

## 本地开发注意事项

当前前端页面中的 API 地址默认写的是线上域名：

- https://cheerful.vsharev.com/api

如果你在本地联调，需要将以下页面中的 API_BASE_URL 改为本地地址：

- /api（推荐通过同域代理）
- 或 http://localhost:4000/api

涉及页面：

- public/index.html
- public/login.html
- public/admin.html

## 部署说明（简要）

仓库根目录的 welink 文件包含 Nginx 配置参考，已包含：

- cheerful.vsharev.com 反向代理到 4000 端口
- /uploads 静态资源转发
- HTTP 到 HTTPS 跳转

生产部署建议：

- 使用 PM2 或 systemd 守护 Node 进程
- 定期备份 MongoDB 数据
- 管理员密码改为强密码并加密存储
- 对上传目录设置访问与容量策略

## 已知限制与建议优化

- 登录 token 目前为简易 token，未做完整鉴权校验
- 用户密码当前为明文存储（建议改为哈希）
- 可补充接口权限控制与审计日志
- 建议增加接口文档（如 OpenAPI）与自动化测试

## 许可证

MIT
