# rain 的文档

公开个人文档网站。仓库根目录就是发布目录，GitHub Pages 直接提供这里的内容；根目录下的页面与资源全部由 `_source/` 生成，**不要直接修改**，否则下次生成会被覆盖。

`_source/content/*.md` 是无 BOM 的 UTF-8 原文，`_source/articles.json` 是文章清单，`_source/build.py` 是唯一的页面生成器。根目录的 `.md` 下载件含 UTF-8 BOM，以兼容部分 Windows 编辑器；`source/*.md` 是无 BOM 的公开副本。

构建会同时生成 `sitemap.xml`、`robots.txt`，并为每个页面输出 canonical、Open Graph 与 Twitter 标签；站点地址和默认分享图在 `_source/site.json` 里配置。

`_source/tools/*.html` 是嵌进站点框架的工具页正文，同目录的 `.js` / `.css` 是它们的资源。`_source/static/` 下的文件按相同相对路径原样发布，用于自带完整 HTML 的独立页面（如 `tools/nutrition/`）和外部资源（如背景图、`module-sort.js`）。

新增文章时，在 `_source/content/` 放入 Markdown，并向 `_source/articles.json` 增加一项。改完后运行：

```bash
python3 _source/publish.py --check   # 预览会改动哪些文件
python3 _source/publish.py           # 构建并写入仓库根目录，提交后自动发布
```

`_source/PUBLISHING.md` 记录原网站与 GitHub 的双站发布流程。

GitHub Pages 若在仓库 Settings → Pages 中启用 `main` 分支的 `/(root)`，根目录提交后会自动发布。

公开恋爱故事 **INFJ × ENFP** 位于 `_source/stories/infj-enfp.html`，对应公开地址 `/stories/infj-enfp/`。它是独立的分享页，不进入技术文章分类；`_source/build.py` 生成站点时会保留此页与首页推荐入口。发布时保持 `stories/infj-enfp/index.html` 与源文件同步。

公开恋爱故事 **ENTP × INFP《贪恋他的脸，赔上了十年》** 位于 `_source/stories/entp-infp.html`，发布路径是 `stories/entp-infp/index.html`；首页有分享入口，重新运行 `_source/build.py` 会自动保留两个恋爱故事。
