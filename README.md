# rain 的文档

公开个人文档网站。仓库根目录就是发布目录，GitHub Pages 直接提供这里的内容；根目录下的页面与资源全部由 `_source/` 生成，**不要直接修改**，否则下次生成会被覆盖。

`_source/content/*.md` 是无 BOM 的 UTF-8 原文，`_source/articles.json` 是文章清单，`_source/build.py` 是唯一的页面生成器。根目录的 `.md` 下载件含 UTF-8 BOM，以兼容部分 Windows 编辑器；`source/*.md` 是无 BOM 的公开副本。

构建会生成 `sitemap.xml`、`robots.txt`，并为页面输出 canonical、Open Graph 与 Twitter 标签；站点地址和默认分享图在 `_source/site.json` 里配置。站点地图只列入明确公开的页面，私人模块使用 `noindex`；搜索设置不能代替访问控制。

`_source/tools/*.html` 是嵌进站点框架的工具页正文，同目录的 `.js` / `.css` 是它们的资源。`_source/static/` 下的文件按相同相对路径发布，用于自带完整 HTML 的独立页面和外部资源；独立 HTML 中的 `__SITE_BASE_URL__` 会在构建时替换成配置地址。

## 目录结构

| 目录 | 内容 |
| --- | --- |
| `_source/content/` | 文章 Markdown 原文 |
| `_source/tools/`、`_source/static/` | 工具页面、脚本、样式和独立页面源码 |
| `_source/database/` | 按饮食、问卷、故事、网站权限和购汇分类的 SQL 与配置说明 |
| `articles/`、`categories/`、`tools/`、`stories/`、`assets/` | 网站生成的页面与资源 |
| `source/` | 无 BOM 的文章原文下载件 |
| `supabase/`、`tests/`、`.github/` | 云端函数、测试及自动化工作流 |

根目录仍保留现有 Markdown 下载件及网站使用的 SQL 公开副本，以兼容现有链接；修改时请编辑 `_source/` 中的原文件，再重新生成发布。

新增文章时，在 `_source/content/` 放入 Markdown，并向 `_source/articles.json` 增加一项。改完后运行：

```bash
python3 _source/publish.py --check   # 预览会改动哪些文件
python3 _source/publish.py           # 构建并写入仓库根目录，提交后自动发布
```

`_source/PUBLISHING.md` 记录原网站与 GitHub 的双站发布流程。

GitHub Pages 若在仓库 Settings → Pages 中启用 `main` 分支的 `/(root)`，根目录提交后会自动发布。

公开故事由 `_source/stories.json` 管理，源页面位于 `_source/stories/`。网站主人可以通过故事管理功能删除；删除当前页面不等于清除公开仓库中的 Git 历史或缓存。
