# 文档网站维护

文章以 `content/*.md` 为原文，`articles.json` 是首页和分类页的唯一文章清单。`build.py` 读取这两类文件，生成首页、分类页、文章预览、供 Windows 下载的 Markdown、无 BOM 的原文，以及一份公共样式表。

## 新增文章

1. 在 `content/` 新增 UTF-8 Markdown 文件。
2. 在 `articles.json` 顶部增加一项：`slug`、`title`、`description`、`tag`、`source`、`date`。
3. 运行 `python3 build.py` 更新 Sites 的 `dist/`；运行 `python3 build.py --output ../github-pages-rain-docs` 生成 GitHub Pages 静态文件。
4. 检查页面和下载件后，分别发布到原网站与 GitHub 仓库。GitHub Pages 若已在仓库设置中启用，提交到 `main` 后由 GitHub 自动部署。

下载链接的 `.md` 文件带 UTF-8 BOM，方便部分 Windows 编辑器识别中文。`content/` 原文及生成的 `source/` 副本是标准无 BOM UTF-8，适合 AI、脚本和版本管理。旧文章的下载地址在生成时保留。

生成器会清空并重建指定输出目录；不要把 `--output` 指向保存其他文件的目录。
