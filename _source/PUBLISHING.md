# 文档网站维护

文章以 `content/*.md` 为原文，`articles.json` 是首页和分类页的唯一文章清单。`categories.json` 定义大类与子分类，文章的 `category` 与 `subcategory` 使用其中的键；标签、分类页和面包屑由同一份分类配置生成。`build.py` 读取这些文件，生成首页、分类页、文章预览、供 Windows 下载的 Markdown、无 BOM 的原文，以及一份公共样式表。

## 新增文章

1. 在 `content/` 新增 UTF-8 Markdown 文件。
2. 在 `articles.json` 顶部增加一项：`slug`、`title`、`description`、`category`、`subcategory`、`source`、`date`。
3. 运行 `python3 build.py` 更新 Sites 的 `dist/`；运行 `python3 build.py --output ../github-pages-rain-docs` 生成 GitHub Pages 静态文件。
4. 检查页面和下载件后，分别发布到原网站与 GitHub 仓库。GitHub Pages 若已在仓库设置中启用，提交到 `main` 后由 GitHub 自动部署。

下载链接的 `.md` 文件带 UTF-8 BOM，方便部分 Windows 编辑器识别中文。`content/` 原文及生成的 `source/` 副本是标准无 BOM UTF-8，适合 AI、脚本和版本管理。旧文章的下载地址在生成时保留。

生成器会清空并重建指定输出目录；不要把 `--output` 指向保存其他文件的目录。


## 手工维护工具

美元购汇工具源文件在 `tools/usd-purchases.html`、`.css`、`.js`，由 `build.py` 一起生成。首页与所有页面导航均提供“手工维护”入口。

登记记录仅存于访问者浏览器的 localStorage，不放入源代码或公开仓库；JSON 导出用于备份和跨设备导入，浏览器打印可保存 PDF。更新网站时须保留存储键 `rain.usd-purchases.v1`，不得发布用户的实际交易记录。

截图视觉文章已补入文章清单，重新生成页面时不会丢失。
