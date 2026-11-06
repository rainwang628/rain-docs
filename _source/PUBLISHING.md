# 文档网站维护

文章以 `content/*.md` 为原文，`articles.json` 是首页和分类页的唯一文章清单。`categories.json` 定义大类与子分类，文章的 `category` 与 `subcategory` 使用其中的键；标签、分类页和面包屑由同一份分类配置生成。`build.py` 读取这些文件，生成首页、分类页、文章预览、供 Windows 下载的 Markdown、无 BOM 的原文，以及一份公共样式表。仓库根目录是生成物，只改 `_source/`，不要直接改根目录的页面。

## 新增文章

1. 在 `content/` 新增 UTF-8 Markdown 文件。
2. 在 `articles.json` 顶部增加一项：`slug`、`title`、`description`、`category`、`subcategory`、`source`、`date`。
3. 运行 `python3 _source/publish.py --check` 查看会改动哪些文件，确认后运行 `python3 _source/publish.py` 构建并覆盖到仓库根目录。
4. 检查页面和下载件后，分别发布到原网站与 GitHub 仓库。GitHub Pages 若已在仓库设置中启用，提交到 `main` 后由 GitHub 自动部署。

下载链接的 `.md` 文件带 UTF-8 BOM，方便部分 Windows 编辑器识别中文。`content/` 原文及生成的 `source/` 副本是标准无 BOM UTF-8，适合 AI、脚本和版本管理。下载文件按默认分类生成到 `assets/downloads/<分类>/<子分类>/`，文章页面链接到对应文件。旧的根目录下载地址不再提供；更改文章分类也会改变下载地址。

生成器会清空并重建 `--output` 指向的目录，不能指向仓库或源码目录；发布脚本只在临时目录构建。`generated-files.json` 记录上次生成的文件及校验值，发布时只清理清单中已不再生成的文件，不会删除 `README.md`、`_source/` 等非生成文件。若待清理的生成文件被手工改过，脚本会停止并提示，避免覆盖或删除修改。

删除文章时，从 `articles.json` 移除条目后先运行 `python3 _source/publish.py --check` 查看将移除的发布文件，再运行发布脚本。原始 Markdown 和不再使用的分享封面仍保留在 `_source/`，如需从当前仓库移除应明确删除它们；公开仓库的 Git 历史与缓存不因此清除。


## SEO 与分享卡片

`site.json` 保存站点地址、名称、语言和默认分享图；生成器与独立 HTML 的 `__SITE_BASE_URL__` 使用同一地址。修改域名后需要重新运行发布脚本，历史文章中的文字链接和 Supabase Auth 的登录回调白名单仍需单独检查。生成器为页面输出 canonical、`og:*` 与 `twitter:*` 标签；文章页的分享图是 `/assets/og/<slug>.png`，找不到时回退到站点默认图。站点地图只列入明确公开的页面；账号、分类管理、故事管理、问卷、购汇记录、饮食管理及小游戏页面带 `noindex,follow` 且不进入 sitemap。新增公开页面时，需要在 `build.py` 的公开路径清单中登记。

当前站点位于 GitHub Pages 的 `/rain-docs/` 子目录，生成的 `/rain-docs/robots.txt` 不是整个域名根目录的 `/robots.txt`，不能依赖它控制搜索引擎。可在搜索平台提交 `/rain-docs/sitemap.xml`；如将来配置了域名根站点，可在根站点的 `robots.txt` 中登记该站点地图。`noindex` 只能请求支持该规则的搜索引擎不收录，不能阻止他人访问公开仓库和页面源码，也不替代数据库权限控制。

页面引用的 `site.css` 和站点脚本用内容哈希作为 `?v=` 版本号，构建时自动计算，改了就变、没改就不变，不需要手工维护版本字符串。`_source/static/` 里的独立页面在引用处写 `__ASSET_VERSION__` 占位符即可，构建会替换成当前哈希。

分享封面由 `_source/make_covers.py` 用 Pillow 渲染，输出到 `_source/static/assets/og/`，再由构建复制到 `/assets/og/`。新增文章后执行一次 `python3 -m pip install pillow && python3 _source/make_covers.py` 即可；不执行也能正常发布，只是新文章会使用默认封面。

## 故事管理与删除

公开故事以 `stories.json` 为清单，源页面保存在 `stories/<slug>.html`，发布副本在网站根目录的 `stories/<slug>/index.html`。新增故事时维护清单与源码并运行发布脚本；生成器会从清单生成“我的模块”入口和 `assets/story-catalog.json`，避免已删除故事在重建时再次出现。“我的模块”按“访客可见”和“授权可见”分组：八仙测评、故事属于前者，其余模块按原有权限显示在后者。网站主人可在每组内调整顺序，已保存的云端排序会分别应用到两组。

网站主人可在「我的模块 → 故事管理」提交删除请求。后台只处理故事：删除首页入口、故事 HTML 源文件与发布副本，同步更新故事清单、站点地图和生成文件清单，再请求 GitHub Pages 重新发布。任务通常几分钟内处理，若发布失败会保留请求并重试。技术文章和 Markdown 不参与此流程。Git 提交历史仍可用于恢复；清理当前文件不等于清除历史或缓存。

GitHub Actions 使用短期 OIDC 身份验证访问仅限主人的请求队列，不把 GitHub 写入密钥或 Supabase 管理密钥写入公开网页。GitHub 的定时任务可能延迟，也可能在公开仓库长期无活动后暂停；管理页面会显示尚未完成的请求。

## 手工维护工具

美元购汇工具源文件在 `_source/tools/usd-purchases.html`、`.css`、`.js`，由 `build.py` 一起生成。首页与所有页面导航均提供“手工维护”入口。

自带完整 HTML 的页面（`tools/nutrition/`、`tools/hidden-persona/`、`tools/games/uno-costume/`）和它们的外部资源放在 `_source/static/` 下对应路径，构建时 HTML 中的 `__SITE_BASE_URL__` 替换为配置地址，其他资源原样复制到根目录。修改这些页面要改 `_source/static/` 里的文件，而不是根目录的副本。

登记记录仅存于访问者浏览器的 localStorage，不放入源代码或公开仓库；JSON 导出用于备份和跨设备导入，浏览器打印可保存 PDF。更新网站时须保留存储键 `rain.usd-purchases.v1`，不得发布用户的实际交易记录。

截图视觉文章已补入文章清单，重新生成页面时不会丢失。


## 手动分类管理

`categories.json` 定义可选大类与子类，`articles.json` 保存发布时的默认归类。云端 `site_article_categories` 的 `main` 行保存文章 slug 对应的归类覆盖。公开页面读取这些公开分类，管理页面使用同一 Supabase 网站账号登录；修改权限在初始化 SQL 中绑定当前维护用户 UUID。

首次登录 `/tools/account/`，复制当前账号的初始化 SQL，再在 SQL Editor 执行；模板 `database/website/website-access-schema.sql` 的 `__OWNER_EMAIL__` 需替换为本人邮箱，然后打开 `/tools/article-categories/`。初始化不会重建 Auth 用户或修改购买记录。删除并重建维护账号后，需重新执行该脚本绑定新 UUID；脚本会保留已保存的分类。

分类保存用 revision 防止设备间覆盖，成功后刷新页面生效。云端不可达时访客页回退到发布时的默认分类。新增文章默认使用清单中的归类；已有 slug 的云端归类优先，不随重新发布被清空。新增可选分类仍需更新 categories.json 并重新发布。

## 模块权限

公开博客不要求登录。`site_members` 保存申请及确认状态，`site_module_permissions` 保存按用户开放的模块，网站主人通过 `/tools/account/` 管理。只有 SQL 初始化绑定的网站主人能调用授权 RPC，用户不能通过前端修改自身确认状态或授予权限。分类读数据仍公开，写入要求分类管理权限。购买记录增加 restrictive RLS 模块检查，保留原来的逐账号隔离。

登录后的新用户自动提交访问申请；用户需先在 Auth 完成邮箱确认。若默认邮件服务限制陌生收件人或频率，网站主人可以配置自定义 SMTP，或在 Authentication > Users 手工创建确认属于该朋友的网站账号。URL Configuration 还需加入 `/tools/account/` 的完整地址。

GitHub Pages 上的 HTML、JS 和静态小游戏代码依然公开可下载；界面隐藏是导航体验，云端 RLS 和受控 RPC 才是数据及操作权限。不能在静态文件内存储凭据或依赖页面隐藏来保护敏感数据。小游戏当前为浏览器内投骰子及随机选人，没有云端房间或多人实时同步。

## 问卷调研

页面源码在 tools/surveys.* 与 surveys-model.js，初始化 SQL 原文在 database/surveys/surveys-schema.sql，公开副本生成到 assets/sql/surveys-schema.sql。执行一次该脚本后，活动模板问卷会自动创建。管理入口 /tools/surveys/ 仅网站主人可管理；分享地址参数 id 是问卷 UUID，朋友可免登录填写。数据库不保存答卷者账号、姓名或邮箱。

列表、答卷和统计数据通过 RLS 限定网站主人；公开 RPC 只读取指定问卷及校验后提交答卷。评分 0 表示未参加，不进入均值。单个浏览器按固定提交 UUID 幂等重试；清除浏览器存储或换设备可再次提交，此机制不是每人限填一次。草稿仅存当前设备。数据库不删除历史答卷，结束收集可重新开放。模板和新问卷创建后题目不再修改，避免已有答卷失去含义。

脚本可重复执行，保留已有问卷、答卷和关闭状态。导出 CSV 为当前筛选结果，带 UTF-8 BOM，并处理表格公式前缀。首次执行需要既有 site_is_owner() 函数，不需修改已有权限枚举或购买数据。

随机昵称由每份问卷的随机提交 UUID 生成，填写页、答卷明细、昵称搜索与 CSV 导出一致；刷新同一浏览器同一问卷保持昵称，不使用账号、设备指纹或真实身份。浏览器禁用存储时当前页面仍可生成昵称并幂等重试。不同问卷独立生成提交 UUID。昵称无需新增数据库字段或再次执行迁移，历史答卷也可由编号显示昵称。

