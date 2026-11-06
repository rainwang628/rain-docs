# GitHub Pages 个人站重构：统一构建源与 SEO 补全

这个站点的页面一直由 `_source/build.py` 生成，但生成结果需要手工复制到仓库根目录才会上线。改得多了之后，根目录和 `_source/` 慢慢变成了两套东西：有些页面只在根目录里有，有些页面线上比源文件新。

这次把两套合成一套，顺带补齐了 SEO，也踩到了一次 GitHub Pages 部署卡死。本文记录改造思路、验证方法和这次故障的排查过程。

## 一、问题：生成器和线上不是一套

README 一直写着 `build.py` 是唯一的页面生成器。实际比对后发现，它并不知道三个页面的存在：

| 页面 | 路径 | build.py 是否生成 |
| --- | --- | --- |
| 饮食管理 | `tools/nutrition/` | 否 |
| 八仙反差人格测试 | `tools/hidden-persona/` | 否 |
| UNO 装备大赛 | `tools/games/uno-costume/` | 否 |

另外几个工具页的线上版本比 `_source/tools/` 里的源文件新：模块首页多了拖拽排序和两个新入口，问卷页换过几次资源版本号，情侣主题的样式只存在于 `assets/surveys.css`。

根源是每个工具页存了两份：`_source/tools/x.html` 是嵌进站点框架的正文，`tools/x/index.html` 是生成后的完整页面。两边各自演化就会分叉。

后果很具体：当时如果跑一次 `build.py` 再覆盖到根目录，`tools/index.html` 会退回旧版——饮食管理和八仙人格的入口会从导航里消失，问卷的情侣主题样式会被旧 CSS 覆盖回去。也就是说，**生成器已经不能安全地重建这个站点了**。

## 二、先把目标写成一条能验证的规则

在动手之前，先定一条可检验的规则：

> 构建输出与仓库根目录逐字节一致。

只要这条成立，重建就永远不会丢东西，也不需要每次发布前肉眼检查。验证方式比人眼可靠：

```text
$ python3 _source/publish.py --check
would change 0 files
```

改造的第一步不是写代码，而是反向对齐——**以线上为准**，把已经分叉的页面回填成源文件，而不是让旧源覆盖线上。顺序反过来，就会真的丢功能。

## 三、改造：让根目录变成纯输出

新的目录职责：

| 位置 | 角色 |
| --- | --- |
| 仓库根目录 | 生成物，GitHub Pages 直接发布，不再手改 |
| `_source/content/`、`articles.json` | 文章原文与文章清单 |
| `_source/tools/` | 嵌进站点框架的工具页正文与资源 |
| `_source/static/` | 按相同路径原样发布：自带完整 HTML 的页面、背景图、独立脚本 |

`_source/static/` 是这次新增的机制。饮食管理、八仙人格、UNO 这三个页面本身就是完整 HTML，不需要套框架，放进 `static/` 后按相对路径复制到输出目录即可。它们的资源（`nutrition.js`、`module-sort.js`、`couple-*.svg`）也一并收进来，从此 `assets/` 里不再有"没有源"的文件。

发布脚本把"构建"和"覆盖"合成一步，避免手工复制时的漏拷：

```bash
python3 _source/publish.py --check   # 只报告会改动哪些文件
python3 _source/publish.py           # 构建并写回仓库根目录
```

脚本在临时目录里构建，然后逐个覆盖根目录的同名文件。它不会删除 `README.md`、`_source/`、`.github/` 这些非生成文件，所以即使源里少写了什么，也不会误删仓库内容。

顺手修掉的几处问题：

- `build.py` 原来在样式表末尾重复追加了 535 字节已经存在的 CSS，属于历史遗留；
- 真心话大冒险页的自定义页脚 `rain 的文档 · 今晚有点不对劲` 在生成时丢失，现在由 `page()` 的参数控制；
- 生成器用了 f-string 里带反斜杠的写法，只有 Python 3.12 以上能解析，已改成等价的普通写法，Python 3.9 也能跑。

## 四、SEO：静态站能做的其实不少

改造前全站没有一个 `canonical`，没有 `og:` 标签，也没有 `sitemap.xml` 和 `robots.txt`。对个人站来说这些成本很低，但分享出去的效果差别明显。

### 1. 元信息

每个页面现在输出 canonical、Open Graph 和 Twitter 卡片标签，形如：

```html
<link rel="canonical" href="https://rainwang628.github.io/rain-docs/articles/xxx/">
<meta property="og:type" content="article">
<meta property="og:title" content="文章标题 · rain 的文档">
<meta property="og:image" content="https://rainwang628.github.io/rain-docs/assets/og/xxx.png">
<meta name="twitter:card" content="summary_large_image">
```

站点地址只写一处，放在 `_source/site.json`：

```json
{
  "base_url": "https://rainwang628.github.io/rain-docs",
  "name": "rain 的文档",
  "locale": "zh_CN",
  "twitter_card": "summary_large_image",
  "og_image": "/assets/og/home.png"
}
```

以后绑定自定义域名，改这一行即可，不用全站搜索替换。项目型 GitHub Pages 的地址带仓库路径（`/rain-docs/`），canonical 必须写成完整绝对地址，这一点容易漏。

### 2. 分享卡片

`og:image` 是一张 1200×630 的图片，由 `_source/make_covers.py` 用 Pillow 渲染：顶部是分类面包屑，中间是标题（自动换行、过长时自动缩小字号），下面是摘要，底部是日期。文章新增后跑一次脚本，会按 `articles.json` 为每篇生成一张。

生成的 PNG 用 256 色调色板重新量化，合集从 648KB 降到 272KB，肉眼几乎看不出差别。图片缺失时构建会回退到站点默认图，不会出现引用 404。

### 3. 抓取

构建时自动生成 `sitemap.xml` 和 `robots.txt`：文章页带 `lastmod`，首页、分类页和公开工具页也一并列出。管理类页面（账号、分类管理、故事管理、问卷、购汇记录）带 `noindex,follow`，并且不进入 sitemap——不希望它们出现在搜索结果里，但也不建议用 `robots.txt` 的 `Disallow` 去屏蔽，那样反而可能让 URL 被索引而内容为空。

结构化数据也补了：首页是 `WebSite`，文章页是 `TechArticle`，故事页是 `Article`。

## 五、发布时踩的坑：部署卡住 ≠ 构建失败

推送之后站点一直不更新，首页标题还是旧的。第一反应是构建内容出了问题，于是反复看 `pages/builds` 接口——它报 `Page build failed`，看不出更多细节。

真正的线索在 Actions 的运行记录里：那次 `pages build and deployment` 的 **build job 是 success，deploy job 一直停在 in_progress**。

| 观察点 | 看到的现象 | 说明 |
| --- | --- | --- |
| `pages/builds` | `errored` | 容易误判成内容构建失败 |
| Actions 的 build job | `success` | 页面其实已经构建好了 |
| Actions 的 deploy job | `in_progress` 长时间不动 | 卡在部署阶段 |

GitHub Pages 的部署有并发组，一个挂住的部署会把后面所有发布都堵住。这种情况下改代码、反复重推都没用。

处理方式是调用取消接口：

```bash
curl -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $TOKEN" \
  "https://api.github.com/repos/<owner>/<repo>/pages/deployments/<id>/cancel"
```

返回 `204` 之后约三分钟，部署自行完成，站点更新。之后要排查发布问题，先看 Actions 里 build 和 deploy 两个 job 分别是什么状态，比只看 `pages/builds` 准确得多。

## 六、现在的日常流程

1. 在 `_source/content/` 写 Markdown，文章清单里加一条。
2. 需要新封面时运行 `python3 _source/make_covers.py`（依赖 Pillow，只在这一步用到）。
3. `python3 _source/publish.py --check` 确认改动范围，去掉 `--check` 执行发布。
4. 提交并推送，GitHub Pages 自动部署。
5. 部署后打开线上地址确认，必要时用社交平台的卡片调试工具验证分享效果。

盯着一句 `would change 0 files`，比每次发布前手工核对三十个页面省心得多。这次改造之后，生成器重新变成了可信的入口。

## 官方参考

- [GitHub Pages 的构建与发布](https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages)
- [GitHub Pages 部署的排查说明](https://docs.github.com/en/pages/using-github-pages/troubleshooting-jekyll-build-errors-for-github-pages-sites)
- [取消 Pages 部署的接口](https://docs.github.com/en/rest/pages/pages#cancel-a-pages-deployment)
- [Open Graph 协议](https://ogp.me/)
- [sitemap 协议](https://www.sitemaps.org/protocol.html)
