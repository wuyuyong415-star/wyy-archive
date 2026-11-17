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
  pages/            首页 / 归档页 / 证书页
public/
  assets/           样式与脚本，原样拷贝进 dist
  assets/uploads/   后台上传的图片
build.mjs           构建脚本：md + site.json → dist/
wrangler.jsonc      Cloudflare 部署配置（name 决定网址前缀）
.pages.yml          网页后台的字段配置
dist/               构建产物，每次构建会整体重建，不要手改
```

构建后每篇文章输出到**站点根目录**的 `<slug>.html`（如 `db-index.html`），所以页面之间全用相对路径，不依赖子目录。

---

## 内容模型

### 分区（section）

固定五个，不能自己加：

| 值 | 显示名 |
|---|---|
| `notes` | 笔记 |
| `thoughts` | 想法 |
| `projects` | 项目 |
| `diary` | 日记 |
| `files` | 文件 |

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
4. 保存 → 自动提交到仓库 → Cloudflare 约 1 分钟后重新构建上线

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

## 注意事项

**仓库是公开的。** 所有 `.md` 原文任何人都能直接看到。`draft: true` 只控制「不发布」，不控制「不可见」——日记之类不想公开的内容不要放进这个仓库。

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
