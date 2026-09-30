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


## 手动分类管理

`categories.json` 定义可选大类与子类，`articles.json` 保存发布时的默认归类。云端 `site_article_categories` 的 `main` 行保存文章 slug 对应的归类覆盖。公开页面读取这些公开分类，管理页面使用同一 Supabase 网站账号登录；修改权限在初始化 SQL 中绑定当前维护用户 UUID。

首次登录 `/tools/account/`，复制当前账号的初始化 SQL，再在 SQL Editor 执行；公开模板 `tools/website-access-schema.sql` 的 `__OWNER_EMAIL__` 需替换为本人邮箱，然后打开 `/tools/article-categories/`。初始化不会重建 Auth 用户或修改购买记录。删除并重建维护账号后，需重新执行该脚本绑定新 UUID；脚本会保留已保存的分类。

分类保存用 revision 防止设备间覆盖，成功后刷新页面生效。云端不可达时访客页回退到发布时的默认分类。新增文章默认使用清单中的归类；已有 slug 的云端归类优先，不随重新发布被清空。新增可选分类仍需更新 categories.json 并重新发布。

## 模块权限

公开博客不要求登录。`site_members` 保存申请及确认状态，`site_module_permissions` 保存按用户开放的模块，网站主人通过 `/tools/account/` 管理。只有 SQL 初始化绑定的网站主人能调用授权 RPC，用户不能通过前端修改自身确认状态或授予权限。分类读数据仍公开，写入要求分类管理权限。购买记录增加 restrictive RLS 模块检查，保留原来的逐账号隔离。

登录后的新用户自动提交访问申请；用户需先在 Auth 完成邮箱确认。若默认邮件服务限制陌生收件人或频率，网站主人可以配置自定义 SMTP，或在 Authentication > Users 手工创建确认属于该朋友的网站账号。URL Configuration 还需加入 `/tools/account/` 的完整地址。

GitHub Pages 上的 HTML、JS 和静态小游戏代码依然公开可下载；界面隐藏是导航体验，云端 RLS 和受控 RPC 才是数据及操作权限。不能在静态文件内存储凭据或依赖页面隐藏来保护敏感数据。小游戏当前为浏览器内投骰子及随机选人，没有云端房间或多人实时同步。
