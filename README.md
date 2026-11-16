# wyy · 个人档案站

Markdown 驱动 + 网页后台的静态博客。改内容不需要碰 HTML。

## 目录结构

```
content/
  posts/          每篇文章一个 .md 文件 ← 日常只改这里
  site.json       站点名、分区、项目、证书 ← 偶尔改
src/
  pages/          首页 / 列表页 / 证书页模板
  post.html       文章页模板
public/
  assets/         样式与脚本（建站时原样拷贝到 dist）
  assets/uploads/ 后台上传的图片放这里
build.mjs         构建脚本：md + site.json → dist/
wrangler.jsonc    Cloudflare 部署配置
.pages.yml        网页后台（Pages CMS）的字段配置
```

## 本地写作流程

1. 在 `content/posts/` 新建一个 `.md`，文件名会成为网址（用英文，如 `my-first-post.md`）
2. 开头写 frontmatter：

```yaml
---
title: 标题
date: 2026-11-20
section: notes        # notes | thoughts | projects | diary | files
summary: 列表页显示的一句话摘要
tags:
  - 标签
---
```

3. 下面正常写 Markdown
4. 运行 `npm run build`，双击 `dist/index.html` 预览
5. 提交到 GitHub，Cloudflare 自动构建上线

> 小提示：Markdown 的加粗 `**` 前后要留空格，否则紧贴中文标点时不生效。
> 错误：`问题是：**为什么？**哈希表`
> 正确：`问题是：**为什么？** 哈希表`

## 部署（Cloudflare Workers）

构建命令 `npm run build`，部署命令 `npx wrangler deploy`，输出目录 `dist`。
Worker 名字在 `wrangler.jsonc` 的 `name` 字段，它决定网址前缀。

## 网页后台（Pages CMS）

仓库推到 GitHub 后，打开 https://app.pagescms.org ，用 GitHub 登录并授权这个仓库，
就能在网页上新建 / 编辑文章：左边文件列表，右边表单 + Markdown 编辑器，保存即提交，
Cloudflare 会自动重新构建。

**注意**：GitHub 免费账号的仓库是公开的，所有 `.md` 和 `site.json` 别人都能看到源码。
日记之类不想公开的内容，用 `draft: true` 标草稿（不会发布），或者干脆不要放进这个仓库。
