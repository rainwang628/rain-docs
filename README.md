# rain 的文档

公开个人文档网站。首页、分类页和文章页位于仓库根目录，Markdown 下载件也位于根目录。

`_source/content/*.md` 是无 BOM 的 UTF-8 原文，`_source/articles.json` 是文章清单，`_source/build.py` 是唯一的页面生成器。根目录的 `.md` 下载件含 UTF-8 BOM，以兼容部分 Windows 编辑器；`source/*.md` 是无 BOM 的公开副本。

新增文章时，在 `_source/content/` 放入 Markdown，并向 `_source/articles.json` 增加一项。运行 `python3 _source/build.py --output site-build` 可生成完整静态站点，再将生成文件发布到仓库根目录。`_source/PUBLISHING.md` 记录原网站与 GitHub 的双站发布流程。

GitHub Pages 若在仓库 Settings → Pages 中启用 `main` 分支的 `/(root)`，根目录提交后会自动发布。
