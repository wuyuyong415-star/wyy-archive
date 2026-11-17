# wyy · 个人档案站

一个 Markdown 驱动、带网页后台的静态博客：文章是仓库里的 `.md` 文件，每次推送后 Cloudflare 自动构建并全球分发。写文章不需要碰 HTML，也不需要命令行。

| 用途 | 地址 |
|---|---|
| 网站 | https://wyy.wuyuyong415.workers.dev |
| 写作后台 | https://app.pagescms.org |
| 托管控制台 | https://dash.cloudflare.com |

---

## 技术栈

| 环节 | 用了什么 | 说明 |
|---|---|---|
| 托管 | Cloudflare Workers 静态资源 | 免费、静态请求不计费不限量、自带 HTTPS |
| 仓库 | GitHub `wuyuyong415-star/wyy-archive` | Public，文章原文在这里 |
| 构建 | `build.mjs`（Node + marked + gray-matter） | 自写脚本，无框架依赖 |
| 网页后台 | Pages CMS | 通过 GitHub 应用授权，保存即提交 |
| 网址转换 | pinyin-pro | 中文标题自动转拼音 |
| 部署 | wrangler v4 | 由 Cloudflare 构建服务调用 |

运行环境：Node ≥ 20（线上实际为 Node 24 / npm 10）。

---

## 目录结构

```
content/
  posts/            每篇文章一个 .md  ← 日常写作只碰这里
  site.json         站点名、分区、项目、证书  ← 偶尔改
src/
  post.html         文章页模板（含 {{TITLE}} 等占位符）
  pages/            首页 / 归档页 / 证书页 / 404
  admin.html        评论管理页（不公开链接，noindex）
  worker.js         评论接口（/api/*），其余请求交还静态资源
public/
  assets/           样式与脚本，原样拷贝进 dist
  assets/uploads/   后台上传的图片
build.mjs           构建脚本：md + site.json → dist/
wrangler.jsonc      Cloudflare 部署配置（name 决定网址前缀，D1 绑定在这里）
.pages.yml          网页后台的字段配置
dist/               构建产物，每次构建会整体重建，不要手改
```

构建后每篇文章输出到**站点根目录**的 `<slug>.html`（如 `db-index.html`），所以页面之间全用相对路径，不依赖子目录。

---

## 内容模型

### 分区（section）

分区本身写在 `content/site.json` 的 `sections` 里，网页后台「站点设置 → 分区」也能改，所以可以自己增删和改名。当前的六个：

| 值 | 显示名 | 说明 |
|---|---|---|
| `certs` | 证书 | 独立页面 `certs.html`，数据来自 `site.json` 的 `certs`，不是文章 |
| `notes` | 学习笔记 | 时间线列表 |
| `thoughts` | 思考 | 时间线列表 |
| `projects` | 项目 | 时间线列表；首页卡片数据来自 `site.json` 的 `projects` |
| `diary` | 日记 | 时间线列表 |
| `files` | 学习资料 | 时间线列表 |

文章头部 `section` 填上表中的**值**（不是显示名）。`name`、`desc`、`icon`、`color`、`unit` 都可以随便改，前端会自动读取。

### 文章头部字段

```yaml
---
title: 标题
date: 2026-11-20
section: notes
summary: 列表页和搜索结果里显示的一句话
tags:
  - 标签一
  - 标签二
minutes: 5          # 可省略，省略时按字数自动估算
slug: my-url        # 可省略，省略时按标题自动转拼音
draft: false        # 可省略，true 时构建跳过
---
```

正文就是普通 Markdown。

---

## 写作流程

### 方式一：网页后台（推荐）

1. 打开 https://app.pagescms.org，GitHub 登录
2. 选仓库 `wuyuyong415-star/wyy-archive`，分支 `main`
3. 左侧「文章」→ 添加条目，填标题、日期、分区、摘要，正文写 Markdown
4. 「站点设置」→ 可以在后台改站点名、网址、分区、项目、证书，不用手写 JSON
5. 保存 → 自动提交到仓库 → Cloudflare 约 1 分钟后重新构建上线

修改已发布文章同理，点「编辑」即可。想插图先在「媒体」上传，再插入正文。

### 方式二：本地

1. 在 `content/posts/` 新建 `.md`，文件名会成为网址（用英文，如 `my-first-post.md`）
2. 按上面的格式写头部和正文
3. `npm install`（首次）→ `npm run build`
4. 双击 `dist/index.html` 预览
5. `git add -A && git commit -m "新文章" && git push`，等自动构建

### 网址规则

按优先级取：

1. 头部写了 `slug: my-url` → `/my-url.html`
2. 否则取文件名
3. 文件名含中文时自动转拼音 → `为什么索引必须有序.md` → `/wei-shen-me-suo-yin-bi-xu-you-xu.html`
4. 万一转不出有效字符 → `/post-<日期>.html`

改网址等于换链接，已发布的文章尽量不要改 `slug`。

---

## 本地构建

```bash
npm install
npm run build     # md + site.json -> dist/
```

构建会打印文章清单和产物数量。`dist/` 每次被整体删除重建，所以不要在里面直接改东西。

## 部署

构建命令 `npm run build`，部署命令 `npx wrangler deploy`，静态资源目录 `./dist`。

在 Cloudflare 里是 **Compute → Workers & Pages → 该 Worker → 连接 Git 仓库**的托管构建模式：`main` 分支每次有推送就自动构建并部署。**不要再在控制台手动拖文件上传**，那样会和 Git 构建互相覆盖。

`wrangler.jsonc` 的 `name` 必须与 Cloudflare 上的 Worker 名一致（当前为 `wyy`），否则构建产物会部署到另一个 Worker 上。

---

## 评论

文章页底部有评论区，匿名昵称即可发言，**发出去立刻显示**，你可以在 `/admin` 里把不合适的隐藏掉。

因为站点本来是纯静态的，评论需要三个额外的部件：

| 部件 | 位置 | 作用 |
|---|---|---|
| Worker 脚本 | `src/worker.js` | 只接管 `/api/*`，其余请求原样交给静态资源 |
| D1 数据库 | Cloudflare → 存储和数据库 → D1 | 存评论；表在第一次请求时自动建 |
| 管理口令 | Worker 环境变量 `ADMIN_TOKEN` | 打开 `/admin` 用的密码 |

一次性配置（只做一遍）：

1. Cloudflare 控制台 → **存储和数据库 → D1 SQL 数据库 → 创建**，名字填 `wyy-comments`
2. 创建后复制 **Database ID**，填进 `wrangler.jsonc` 的 `database_id`
3. Worker → **设置 → 变量和机密 → 添加**，类型选「机密」，名称 `ADMIN_TOKEN`，值自己定一串

之后每次 `git push`，Cloudflare 会同时部署 Worker 和静态资源。

**防垃圾评论**：表单里有一个对真人不可见的蜜罐字段，填了就当成功但不入库；同一 IP 10 分钟内最多 3 条；昵称 20 字、正文 1000 字上限。仍然漏进来的，去 `/admin` 点「隐藏」。

`/admin` 不进导航、不进 sitemap、`robots.txt` 里也 Disallow 了，但**它本身没有登录系统**——靠你不知道口令进不去。口令只存在你浏览器的 localStorage 里，不会出现在网址里（管理接口同时支持 `?token=`，方便命令行调试）。

---

## 站点自带的功能

构建和前端脚本已经实现，改内容时不用管：

| 功能 | 在哪里 | 说明 |
|---|---|---|
| 归档筛选 | `list.html` | 分区 chip、标签云、年份、关键词四种筛选可叠加，状态同步到网址 |
| 分页 | `list.html` | 每页 10 条，不足一页自动隐藏；`PAGE_SIZE` 在 `site.js` 顶部 |
| 全站搜索 | 首页搜索框 | 输入即时过滤「最近更新」，**回车**跳到归档页做全站搜索 |
| 代码高亮 + 复制 | 文章页 | 按语言给注释/字符串/关键字/数字上色，右上角一键复制 |
| 更新热力图 | 首页右上 | 按文章 `date` 真实统计最近 14 周，不再有假数据 |
| 文章目录 | 文章页右侧 | 由正文 `##` / `###` 自动生成，滚动高亮 |
| RSS | `/feed.xml` | 全文摘要 + 分区，可直接订阅 |
| 站点地图 | `/sitemap.xml` | 给搜索引擎用；`/robots.txt` 里已指向它 |
| 404 页 | `404.html` | `wrangler.jsonc` 的 `not_found_handling: "404-page"` 已配好 |
| 分享卡片 | 所有页面 | 构建时注入 `og:*`、canonical、favicon、theme-color |
| 手机导航 | 全站 | ≤820px 显示汉堡菜单 |
| 定时发布 | 构建时 | `date` 填未来日期的文章，到日子之前构建会跳过 |
| 评论 | 文章页底部 | 匿名昵称、即时显示、蜜罐 + 频率限制，见上一节 |
| 评论管理 | `/admin` | 输口令后能看全部评论并隐藏/恢复 |

定时发布依赖「到那天有新的构建」——如果你的仓库那天没有推送，它不会自动出现。想准时上线就设个提醒当天推一次。

---

## 注意事项

**仓库是公开的。** 所有 `.md` 原文任何人都能直接看到。`draft: true` 只控制「不发布」，不控制「不可见」——日记之类不想公开的内容不要放进这个仓库。

**证书的「验证」列。** 显示「待补充」说明 `site.json` 里那张证书的 `url` 还是 `#`。填上机构查询页地址后会自动变成可点的「验证 ↗」。分类填 `exam` / `contest` / `course` 才会归到对应 chip。

**加粗符号要留空格。** Markdown 的 `**` 紧贴中文标点时不生效：

- 错误：`问题是：**为什么？**哈希表` → 星号原样显示
- 正确：`问题是：**为什么？** 哈希表`

**图片路径。** 后台插图可能写成 `public/assets/uploads/x.png`，而 `public/` 不进入站点根。构建时会自动改写为 `/assets/uploads/x.png`，一般无需处理；如果图片仍 404，检查正文里的路径是否写成了其他前缀。

**中文标题的网址。** 自动转拼音，不是中文原文。想要指定网址就填 `slug`。

**新增依赖要写进 `package.json`。** 线上构建只按 `package.json` 安装，本地装了没提交会构建失败。

**没有访客统计。** 纯静态站不经过自有代码，Cloudflare 不统计请求。需要 PV/UV 得自己插入一段 Web Analytics 的 JS。

**国内访问速度。** `workers.dev` 无境内节点，速度和本地服务器 + ICP 备案不在一个量级，这是这套免费方案的固有短板。

---

## 迁移

内容全是纯文本文件存在 Git 仓库里，随时可以整体搬到任何支持静态托管的平台（Vercel、Netlify、Cloudflare Pages、自己的服务器）——`npm run build` 之后把 `dist/` 丢过去即可，不锁定供应商。
