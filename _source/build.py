"""Build the public documentation site from articles.json and content/*.md.

Usage: python3 build.py [--output dist]
"""
from pathlib import Path
import argparse
import hashlib
import html
import json
import re
import shutil
from urllib.parse import urlsplit

root = Path(__file__).resolve().parent

def inline(value):
    value = html.escape(value)
    value = re.sub(r'\[([^]]+)\]\((https?://[^)]+)\)', lambda m: f'<a href="{m.group(2)}" target="_blank" rel="noopener noreferrer">{m.group(1)}</a>', value)
    value = re.sub(r'`([^`]+)`', r'<code>\1</code>', value)
    return re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', value)

def render_markdown(lines):
    parts=[]; i=0
    while i < len(lines):
        line=lines[i]
        if not line.strip(): i+=1; continue
        if line.startswith('```'):
            lang=line[3:].strip(); code=[]; i+=1
            while i<len(lines) and not lines[i].startswith('```'): code.append(lines[i]); i+=1
            parts.append(f'<div class="code-head">{html.escape(lang or "TEXT")}</div><pre><code>{html.escape(chr(10).join(code))}</code></pre>'); i+=1; continue
        if line.startswith('|') and i+1<len(lines) and re.match(r'^\|[\s:|\-]+\|$',lines[i+1]):
            heads=[c.strip() for c in line.strip('|').split('|')]; i+=2; rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                rows.append([c.strip() for c in lines[i].strip('|').split('|')]); i+=1
            parts.append('<div class="table-wrap"><table><thead><tr>'+''.join(f'<th>{inline(c)}</th>' for c in heads)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{inline(c)}</td>' for c in row)+'</tr>' for row in rows)+'</tbody></table></div>'); continue
        if line.startswith('#'):
            n=len(line)-len(line.lstrip('#'))
            parts.append(f'<h{n}>{inline(line[n:].strip())}</h{n}>'); i+=1; continue
        if line.startswith('> '): parts.append(f'<p class="note">{inline(line[2:])}</p>'); i+=1; continue
        if re.match(r'^\d+\. ',line) or line.startswith('- '):
            ordered=bool(re.match(r'^\d+\. ',line)); tag='ol' if ordered else 'ul'; items=[]
            while i<len(lines) and (re.match(r'^\d+\. ',lines[i]) if ordered else lines[i].startswith('- ')):
                item_text=re.sub(r'^\d+\. |^- ', '', lines[i])
                items.append(f'<li>{inline(item_text)}</li>'); i+=1
            parts.append(f'<{tag}>'+''.join(items)+f'</{tag}>'); continue
        buf=[line]; i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#|>|```|\||- |\d+\. )',lines[i]): buf.append(lines[i]); i+=1
        parts.append('<p>'+inline(' '.join(buf))+'</p>')
    return '\n'.join(parts)

css = """
:root{--ink:#1e3140;--muted:#637784;--accent:#146e5d;--line:#d9e4e7;--bg:#f4f7f8;--paper:#fff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.75 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--accent);text-underline-offset:3px}.top{background:#203746;color:#fff}.top-inner{max-width:1160px;margin:auto;padding:17px 28px;display:flex;align-items:center;gap:20px}.brand{font-size:19px;font-weight:750;color:#fff;text-decoration:none;white-space:nowrap;margin-right:auto}.account-status{color:#d1e2e5;text-decoration:none;font-size:14px;white-space:nowrap}.account-status:hover{color:#fff;text-decoration:underline}.nav{display:flex;gap:26px}.nav a{color:#d1e2e5;text-decoration:none;font-size:14px}.nav a:hover,.nav a[aria-current=page]{color:#fff;text-decoration:underline}.wrap{max-width:1160px;margin:auto;padding:42px 28px 80px}.intro{max-width:800px;margin-bottom:34px}.eyebrow{color:var(--accent);font-size:13px;font-weight:750;letter-spacing:.12em}.intro h1{font-size:clamp(32px,4vw,50px);line-height:1.2;margin:11px 0 15px}.intro p{color:var(--muted);font-size:17px;margin:0}.section-title{font-size:21px;margin:40px 0 16px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.tile,.post{display:block;background:var(--paper);border:1px solid var(--line);border-radius:15px;padding:24px;text-decoration:none;box-shadow:0 9px 27px #18313f0a;transition:transform .15s,border-color .15s}.tile:hover,.post:hover{transform:translateY(-2px);border-color:#9dc9bd}.tile .count,.post .date{font-size:13px;color:var(--muted)}.tile h2,.post h2{color:var(--ink);font-size:21px;line-height:1.4;margin:12px 0 7px}.tile p,.post p{color:var(--muted);margin:0;line-height:1.6}.post{max-width:760px}.tag{display:inline-block;color:var(--accent);font-size:13px;font-weight:750}.crumb{font-size:14px;color:var(--muted);margin-bottom:22px}.crumb a{color:var(--muted)}.document{background:var(--paper);border:1px solid var(--line);border-radius:17px;box-shadow:0 12px 40px #18313f0a}.doc-head{padding:38px clamp(24px,5vw,68px) 28px;border-bottom:1px solid var(--line)}.doc-head h1{font-size:clamp(29px,3.5vw,43px);line-height:1.3;margin:10px 0}.meta{display:flex;align-items:center;gap:18px;flex-wrap:wrap;color:var(--muted);font-size:14px}.download{border:1px solid #b9d8ce;border-radius:8px;padding:6px 12px;text-decoration:none;font-weight:650}.article{max-width:900px;padding:20px clamp(24px,5vw,68px) 65px}.article h1{display:none}.article h2{font-size:24px;line-height:1.35;margin:42px 0 14px;padding-top:13px;border-top:1px solid var(--line)}.article p{margin:15px 0}.article .note{color:var(--muted);font-size:14px}.article li{margin:10px 0}.article ul,.article ol{padding-left:24px}.article code{font:.9em ui-monospace,Consolas,monospace;background:#eaf1f2;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}.code-head{background:#263d4c;color:#b1decf;padding:9px 18px;border-radius:9px 9px 0 0;font:12px ui-monospace,monospace;margin-top:24px}.article pre{background:#172b37;color:#eaf8f4;padding:18px;overflow:auto;border-radius:0 0 9px 9px;margin:0 0 23px;line-height:1.65;font-size:14px}.article pre code{color:inherit;background:none;padding:0;white-space:pre}.footer{max-width:1160px;margin:auto;padding:24px 28px 50px;color:var(--muted);font-size:13px}@media(max-width:750px){.wrap{padding:28px 17px 54px}.top-inner{padding:15px 18px;display:grid;grid-template-columns:1fr auto auto;gap:12px}.nav{grid-column:1/-1;flex-wrap:wrap;gap:14px}.nav a{white-space:nowrap;padding:8px 12px}.nav-ready .menu-toggle{display:inline-flex;align-items:center;justify-content:center}.nav-ready .top-inner:not(.menu-open) .nav{display:none}.nav-ready .account-status{display:inline-flex;align-items:center;justify-content:center}.nav-ready .nav{flex-direction:column;align-items:stretch;border-top:1px solid #ffffff26;padding-top:8px}.nav-ready .nav a[aria-current=page]{background:#ffffff12;border-radius:8px}.grid{grid-template-columns:1fr}.doc-head{padding:26px 22px}.article{padding:10px 22px 45px}.article h2{margin-top:34px}}
[hidden]{display:none!important}.table-wrap{overflow-x:auto;margin:22px 0}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid var(--line);padding:11px 13px;text-align:left;vertical-align:top}th{background:#eaf2f0}tr:nth-child(even) td{background:#f7fafb}
.menu-toggle{display:none;background:transparent;border:1px solid #ffffff50;border-radius:8px;color:#fff;font:inherit;font-size:14px;line-height:1.4;padding:8px 12px;cursor:pointer}.menu-toggle:focus-visible{outline:2px solid #b1decf;outline-offset:3px}

/* Keep the account status and menu controls visually consistent. */
.account-status,.menu-toggle{box-sizing:border-box;min-width:88px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid #ffffff50;border-radius:8px;color:#fff;font:inherit;font-size:14px;line-height:1.4;padding:8px 12px;cursor:pointer;text-decoration:none}
.account-status:hover,.menu-toggle:hover{color:#fff;background:#ffffff12;text-decoration:none}
.account-status:focus-visible,.menu-toggle:focus-visible{outline:2px solid #b1decf;outline-offset:3px}
.menu-toggle{display:none}
@media(max-width:750px){.nav-ready .menu-toggle{display:inline-flex}}
"""

# Desktop: pull the account entry to the far right and keep it compact, so it
# no longer floats in the middle of the top bar between the brand and the nav.
css += '@media(min-width:751px){.account-status{order:3;min-width:0;padding:7px 14px}}' 


def asset_version(name):
    """Short content hash, so a changed asset always gets a new URL."""
    return hashlib.sha256((root / 'tools' / name).read_bytes()).hexdigest()[:10]


CSS_VERSION = hashlib.sha256(css.encode('utf-8')).hexdigest()[:10]
ASSET_VERSION = {name: asset_version(name) for name in (
    'usd-cloud-config.js', 'site-categories.js', 'site-nav.js', 'site-access.js')}



def url(path, depth):
    prefix = '../' * depth or './'
    return prefix + path.lstrip('/') if path != '/' else prefix


SITE = json.loads((root / 'site.json').read_text(encoding='utf-8'))
base_url = SITE['base_url']
parts = urlsplit(base_url)
if (parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password
        or parts.query or parts.fragment or any(c in base_url for c in '\"<>\\\r\n\t ')):
    raise ValueError('site.json base_url must be a plain HTTP(S) site address')


def absolute(path):
    return SITE['base_url'].rstrip('/') + path


def write_standalone_html(source, target):
    """Render the configured site address in standalone page metadata."""
    markup = source.read_text(encoding='utf-8')
    markup = markup.replace('__SITE_BASE_URL__', SITE['base_url'].rstrip('/'))
    markup = markup.replace('__ASSET_VERSION__', CSS_VERSION)
    target.write_text(markup, encoding='utf-8')


def page(title, description, current, body, depth, structured=None, footer='rain 的文档 · 记录可复用的经验',
         path='/', og_type='website', og_image=None, robots=None):
    favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='15' fill='%231e3344'/%3E%3Cpath d='M18 13h20l9 9v29H18z' fill='none' stroke='%23d9f0e6' stroke-width='4'/%3E%3Cpath d='M37 13v11h10M24 34h17M24 42h13' fill='none' stroke='%23d9f0e6' stroke-width='3'/%3E%3C/svg%3E"
    nav = ''.join(
        f'<a href="{url(target, depth)}"' + (' id="account-link"' if key == 'account' else '') + (' aria-current="page"' if current == key else '') + f'>{label}</a>'
        for key, target, label in [('home', '/', '首页'), ('category', '/categories/', '文章分类'), ('tools', '/tools/', '我的模块')]
    )
    data = '<script type="application/ld+json">' + json.dumps(structured, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + '</script>' if structured else ''
    full_title = f'{title} · {SITE["name"]}'
    esc = lambda value: html.escape(value, quote=True)
    canonical = absolute(path)
    image = absolute(og_image or SITE['og_image'])
    seo = [
        f'<link rel="canonical" href="{esc(canonical)}">',
        f'<meta property="og:site_name" content="{esc(SITE["name"])}">',
        f'<meta property="og:locale" content="{esc(SITE["locale"])}">',
        f'<meta property="og:type" content="{esc(og_type)}">',
        f'<meta property="og:title" content="{esc(full_title)}">',
        f'<meta property="og:description" content="{esc(description)}">',
        f'<meta property="og:url" content="{esc(canonical)}">',
        f'<meta property="og:image" content="{esc(image)}">',
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
        f'<meta name="twitter:card" content="{esc(SITE["twitter_card"])}">',
        f'<meta name="twitter:title" content="{esc(full_title)}">',
        f'<meta name="twitter:description" content="{esc(description)}">',
        f'<meta name="twitter:image" content="{esc(image)}">',
    ]
    if robots:
        seo.insert(0, f'<meta name="robots" content="{esc(robots)}">')
    css_url = url(f'/assets/site.css?v={CSS_VERSION}', depth)
    config_url = url('/assets/usd-cloud-config.js?v=' + ASSET_VERSION['usd-cloud-config.js'], depth)
    categories_url = url('/assets/site-categories.js?v=' + ASSET_VERSION['site-categories.js'], depth)
    nav_url = url('/assets/site-nav.js?v=' + ASSET_VERSION['site-nav.js'], depth)
    access_url = url('/assets/site-access.js?v=' + ASSET_VERSION['site-access.js'], depth)
    return (f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{html.escape(full_title)}</title>'
            f'<meta name="description" content="{html.escape(description, quote=True)}">'
            + ''.join(seo) + (
            f'<link rel="icon" type="image/svg+xml" href="{favicon}">'
            f'<link rel="stylesheet" href="{css_url}">{data}'
            f'<script src="{config_url}" defer></script>'
            f'<script src="{categories_url}" defer></script>'
            f'<script src="{nav_url}" defer></script>'
            f'<script src="{access_url}" defer></script>'
            f'</head><body><header class="top"><div class="top-inner">'
            f'<a class="brand" href="{url("/", depth)}">rain / 文档</a>'
            f'<a href="{url("/tools/account/", depth)}" id="account-link" class="account-status">账号</a><button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-navigation" aria-label="展开或收起主导航">☰ 菜单</button><nav class="nav" id="site-navigation" aria-label="主导航">{nav}</nav></div></header>'
            f'{body}<footer class="footer">{footer}</footer></body></html>'))


def build(out):
    articles = json.loads((root / 'articles.json').read_text(encoding='utf-8'))
    categories = json.loads((root / 'categories.json').read_text(encoding='utf-8'))
    stories = json.loads((root / 'stories.json').read_text(encoding='utf-8'))
    story_slugs = [item['slug'] for item in stories]
    if len(story_slugs) != len(set(story_slugs)) or any(not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug) for slug in story_slugs):
        raise ValueError('Invalid or duplicate story slug')
    for item in articles:
        category = categories[item['category']]
        subcategory = category['subcategories'][item['subcategory']]
        item['tag'] = category['title'] + ' · ' + subcategory['title']
    slugs = [item['slug'] for item in articles]
    if len(slugs) != len(set(slugs)):
        raise ValueError('Article slugs must be unique')
    if out == root or out in root.parents or (root in out.parents and out != root / 'dist'):
        raise ValueError('Build output must not overwrite the source tree')
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'assets').mkdir(exist_ok=True)
    sql_assets = out / 'assets' / 'sql'
    sql_assets.mkdir(parents=True, exist_ok=True)
    (out / 'assets' / 'site.css').write_text(css, encoding='utf-8')
    (out / '.nojekyll').touch()

    def card(item, depth):
        return (f'<a class="post" href="{url("/articles/" + item["slug"] + "/", depth)}">'
                f'<span class="tag">{html.escape(item["tag"])}</span>'
                f'<h2>{html.escape(item["title"])}</h2>'
                f'<p>{html.escape(item["description"])}</p>'
                f'<span class="date">{html.escape(item["date"])}</span></a>')

    def category_tile(path, title, description, count, depth):
        return (f'<a class="tile" href="{url(path, depth)}">'
                f'<span class="count">{count:02d} 篇文章</span><h2>{html.escape(title)}</h2>'
                f'<p>{html.escape(description)}</p></a>')

    def category_tiles(depth):
        return ''.join(category_tile('/categories/' + key + '/', category['title'],
                      category['description'], sum(a['category'] == key for a in articles), depth)
                      for key, category in categories.items())

    cards_home = ''.join(card(item, 0) for item in articles)
    count = len(articles)
    story_cards = ''.join(
        f'<a class="tile" href="./stories/{html.escape(story["slug"], quote=True)}/">'
        f'<span class="count">{html.escape(story["badge"])}</span><h2>{html.escape(story["title"])}</h2>'
        f'<p>{html.escape(story["description"])}</p></a>'
        for story in stories
    )
    story_links = ''.join(
        f'<a class="tile" href="{url("/stories/" + story["slug"] + "/", 1)}">'
        f'<span class="count">{html.escape(story["badge"])}</span><h2>{html.escape(story["title"])}</h2>'
        f'<p>{html.escape(story["description"])}</p></a>'
        for story in stories
    )
    stories_section = ('<section aria-label="恋爱故事"><h2 class="section-title">💜 恋爱小故事</h2><div class="grid">'
                       + story_links + '</div></section>') if stories else ''
    fun_body = ('<main class="wrap"><div class="crumb"><a href="../">首页</a> / 轻松一下</div>'
                '<div class="intro"><div class="eyebrow">SIDE NOTES</div><h1>轻松一下</h1>'
                '<p>和技术无关的内容收在这里，不占首页的位置。</p></div>'
                '<section aria-label="八仙人格"><h2 class="section-title">🌿 八仙人格</h2><div class="grid">'
                '<a class="tile" href="../tools/hidden-persona/"><span class="count">凭体验码进入</span>'
                '<h2>八仙反差人格测试</h2><p>12 道题，寻找你最像的八仙人物原型，生成国风报告与分享卡。</p>'
                '</a></div></section>' + stories_section + '</main>')
    home = (f'<main class="wrap"><div class="intro"><div class="eyebrow">PERSONAL NOTES</div>'
            f'<h1>文档与笔记</h1><p>整理日常遇到的问题和已经验证的做法。</p></div>'
            f'<h2 class="section-title">文章分类</h2><div class="grid">{category_tiles(0)}</div>'
            f'<section data-module="usd-purchases" hidden><h2 class="section-title">手工维护</h2><div class="grid"><a class="tile" href="{url("/tools/usd-cloud/", 0)}"><span class="count">个人记录</span><h2>美元购汇记录</h2><p>跨设备登记购买、修改明细，自动计算平均成本。</p></a></div></section>'
            f'<section data-module="article-categories" hidden><h2 class="section-title">分类管理</h2><p><a href="{url("/tools/article-categories/", 0)}">手动调整文章分类</a></p></section>'
            f'<section data-owner hidden><h2 class="section-title">故事管理</h2><p><a href="{url("/tools/story-management/", 0)}">管理和删除故事</a></p></section>'
            f'<h2 class="section-title">最近发布</h2><div class="grid">{cards_home}</div></main>')
    overview = (f'<main class="wrap"><div class="crumb"><a href="{url("/", 1)}">首页</a> / 文章分类</div>'
                f'<div class="intro"><div class="eyebrow">CATEGORIES</div><h1>文章分类</h1>'
                f'<p>{count} 篇文章，按主题浏览。</p></div><div class="grid">{category_tiles(1)}</div><p data-module="article-categories" hidden><a href="{url("/tools/article-categories/", 1)}">管理文章分类</a></p></main>')
    pages = {
        out / 'index.html': page('文档与笔记', '个人笔记与文档分类', 'home', home, 0, path='/', structured={
            '@context': 'https://schema.org', '@type': 'WebSite',
            'name': 'rain 的文档', 'inLanguage': 'zh-CN',
            'url': absolute('/')}),
        out / 'categories/index.html': page('文章分类', '按主题浏览 AI 与技术笔记', 'category', overview, 1, path='/categories/'),
        out / 'fun/index.html': page('轻松一下', '八仙人格测试与恋爱小故事', 'fun', fun_body, 1, path='/fun/'),
    }
    for key, category in categories.items():
        selected = [a for a in articles if a['category'] == key]
        tiles = ''.join(category_tile('/categories/' + key + '/' + subkey + '/', sub['title'],
                       sub['description'], sum(a['subcategory'] == subkey for a in selected), 2)
                       for subkey, sub in category['subcategories'].items())
        cards = ''.join(card(a, 2) for a in selected)
        body = (f'<main class="wrap"><div class="crumb"><a href="{url("/", 2)}">首页</a> / '
                f'<a href="{url("/categories/", 2)}">文章分类</a> / {html.escape(category["title"])}</div>'
                f'<div class="intro"><div class="eyebrow">CATEGORY</div><h1>{html.escape(category["title"])}</h1>'
                f'<p>{html.escape(category["description"])} · {len(selected)} 篇</p></div>'
                f'<h2 class="section-title">子分类</h2><div class="grid">{tiles}</div>'
                f'<h2 class="section-title">全部文章</h2><div class="grid" id="category-articles">{cards}</div></main>')
        pages[out / 'categories' / key / 'index.html'] = page(category['title'], category['description'], 'category', body, 2, path=f'/categories/{key}/')
        for subkey, sub in category['subcategories'].items():
            subset = [a for a in selected if a['subcategory'] == subkey]
            cards = ''.join(card(a, 3) for a in subset)
            body = (f'<main class="wrap"><div class="crumb"><a href="{url("/", 3)}">首页</a> / '
                    f'<a href="{url("/categories/", 3)}">文章分类</a> / '
                    f'<a href="{url("/categories/" + key + "/", 3)}">{html.escape(category["title"])}</a> / '
                    f'{html.escape(sub["title"])}</div><div class="intro"><div class="eyebrow">SUBCATEGORY</div>'
                    f'<h1>{html.escape(sub["title"])}</h1><p>{html.escape(sub["description"])} · {len(subset)} 篇</p></div>'
                    f'<div class="grid" id="category-articles">{cards}</div></main>')
            pages[out / 'categories' / key / subkey / 'index.html'] = page(sub['title'], sub['description'], 'category', body, 3, path=f'/categories/{key}/{subkey}/')
    for item in articles:
        depth = 2
        source = root / item['source']
        if not source.is_file() or source.parent != root / 'content':
            raise ValueError(f'Invalid article source: {item["source"]}')
        original = source.read_text(encoding='utf-8-sig')
        slug = item['slug']
        # Windows Notepad and other legacy readers detect this download as UTF-8.
        download_path = f'assets/downloads/{item["category"]}/{item["subcategory"]}/{slug}.md'
        download = out / download_path
        download.parent.mkdir(parents=True, exist_ok=True)
        download.write_text('\ufeff' + original, encoding='utf-8')
        clean_source = out / 'source' / f'{slug}.md'
        clean_source.parent.mkdir(exist_ok=True)
        clean_source.write_text(original, encoding='utf-8')
        category = categories[item['category']]
        subcategory = category['subcategories'][item['subcategory']]
        body = (f'<main class="wrap"><div class="crumb">'
                f'<a href="{url("/", depth)}">首页</a> / '
                f'<a href="{url("/categories/" + item["category"] + "/", depth)}">{html.escape(category["title"])}</a> / '
                f'<a href="{url("/categories/" + item["category"] + "/" + item["subcategory"] + "/", depth)}">{html.escape(subcategory["title"])}</a> / '
                f'{html.escape(item["title"])}</div><div class="document"><div class="doc-head">'
                f'<span class="tag">{html.escape(item["tag"])}</span>'
                f'<h1>{html.escape(item["title"])}</h1><div class="meta">'
                f'<span>更新于 {html.escape(item["date"])}</span>'
                f'<a class="download" href="{url("/" + download_path, depth)}" download="{slug}.md">'
                f'下载 Markdown 原文</a></div></div>'
                f'<article class="article">{render_markdown(original.splitlines())}</article></div></main>')
        structured = {'@context': 'https://schema.org', '@type': 'TechArticle',
                      'headline': item['title'], 'dateModified': item['date'], 'inLanguage': 'zh-CN'}
        cover = f'/assets/og/{slug}.png'
        if not (root / 'static' / 'assets' / 'og' / f'{slug}.png').exists():
            cover = None
        pages[out / 'articles' / slug / 'index.html'] = page(item['title'], item['description'], 'article', body, depth, structured,
                                                              path=f'/articles/{slug}/', og_type='article', og_image=cover)
    def protect(body, module, depth=2):
        gate = (f'<main id="module-gate" class="wrap"><h1>模块访问</h1><p data-gate-message>正在验证访问权限…</p>'
                f'<p><a href="{url("/tools/account/", depth)}">登录 / 查看权限</a> · <a href="{url("/", depth)}">返回博客</a></p></main>')
        return gate + f'<div data-protected-module="{module}" hidden>' + body + '</div>'
    tool_body = protect((root / 'tools/usd-purchases.html').read_text(encoding='utf-8'), 'usd-purchases')
    tool_page = page('美元购汇记录', '手工登记美元购买与人民币成本', 'tools', tool_body, 2, path='/tools/usd-purchases/', robots='noindex,follow')
    tool_page = tool_page.replace('</head>', '<link rel="stylesheet" href="../../assets/usd-purchases.css"><script src="../../assets/usd-purchases.js" defer></script></head>')
    pages[out / 'tools/usd-purchases/index.html'] = tool_page
    for ext in ('css', 'js'):
        shutil.copyfile(root / f'tools/usd-purchases.{ext}', out / f'assets/usd-purchases.{ext}')
    cloud_body = protect((root / 'tools/usd-cloud.html').read_text(encoding='utf-8'), 'usd-purchases')
    cloud_page = page('美元购汇记录 · 云端版', '跨设备维护美元购买记录', 'tools', cloud_body, 2, path='/tools/usd-cloud/', robots='noindex,follow')
    cloud_page = cloud_page.replace('</head>', '<link rel="stylesheet" href="../../assets/usd-purchases.css"><script src="../../assets/usd-cloud.js?v=20261024-session-stable" defer></script></head>')
    pages[out / 'tools/usd-cloud/index.html'] = cloud_page
    for filename in ('usd-cloud.js', 'usd-cloud-config.js'):
        shutil.copyfile(root / 'tools' / filename, out / 'assets' / filename)
    for filename in ('usd-cloud-schema.sql', 'usd-cloud-setup.md'):
        shutil.copyfile(root / 'database' / 'usd' / filename, sql_assets / filename)
    (out / 'assets/article-catalog.json').write_text(json.dumps({'categories': categories, 'articles': articles}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (out / 'assets/story-catalog.json').write_text(json.dumps(stories, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    story_management = out / 'tools/story-management/index.html'
    story_management.parent.mkdir(parents=True, exist_ok=True)
    write_standalone_html(root / 'tools/story-management.html', story_management)
    for filename in ('story-management.js', 'story-management.css'):
        shutil.copyfile(root / 'tools' / filename, out / 'assets' / filename)
    management_body = protect((root / 'tools/article-categories.html').read_text(encoding='utf-8'), 'article-categories')
    management_page = page('文章分类管理', '手工调整网站文章分类', 'tools', management_body, 2, path='/tools/article-categories/', robots='noindex,follow')
    management_page = management_page.replace('</head>', '<link rel="stylesheet" href="../../assets/usd-purchases.css"><link rel="stylesheet" href="../../assets/article-categories.css"><script src="../../assets/article-categories.js" defer></script></head>')
    pages[out / 'tools/article-categories/index.html'] = management_page
    for filename in ('site-categories.js', 'article-categories.js', 'article-categories.css'):
        shutil.copyfile(root / 'tools' / filename, out / 'assets' / filename)
    for filename in ('site-nav.js', 'site-access.js', 'site-account.js'):
        shutil.copyfile(root / 'tools' / filename, out / 'assets' / filename)
    shutil.copyfile(root / 'database/website/website-access-schema.sql', sql_assets / 'website-access-schema.sql')
    account_body = (root / 'tools/site-account.html').read_text(encoding='utf-8')
    account_page = page('账号与权限', '申请与管理网站模块访问', 'account', account_body, 2, path='/tools/account/', robots='noindex,follow')
    account_page = account_page.replace('</head>', '<link rel="stylesheet" href="../../assets/usd-purchases.css"><link rel="stylesheet" href="../../assets/article-categories.css"><script src="../../assets/site-account.js?v=20261107-sql-path" defer></script></head>')
    pages[out / 'tools/account/index.html'] = account_page
    game_body = protect((root / 'tools/games.html').read_text(encoding='utf-8'), 'games')
    game_page = page('小游戏', '与朋友一起玩的小工具', 'tools', game_body, 2, path='/tools/games/', robots='noindex,follow')
    game_page = game_page.replace('</head>', '<link rel="stylesheet" href="../../assets/usd-purchases.css"></head>')
    pages[out / 'tools/games/index.html'] = game_page
    hub_page = page('我的模块', '访问已授权的网站模块', 'tools', (root / 'tools/module-hub.html').read_text(encoding='utf-8'), 1, path='/tools/')
    hub_page = hub_page.replace('</head>', (root / 'tools/module-hub.head.html').read_text(encoding='utf-8') + '</head>')
    pages[out / 'tools/index.html'] = hub_page
    party_body = protect((root / 'tools/truth-or-dare.html').read_text(encoding='utf-8'), 'games', 3)
    party_page = page('今晚有点不对劲 · 真心话大冒险', '与朋友一起玩的小工具', 'tools', party_body, 3, footer='rain 的文档 · 今晚有点不对劲', path='/tools/games/truth-or-dare/', robots='noindex,follow')
    party_page = party_page.replace('</head>', '<link rel="stylesheet" href="../../../assets/usd-purchases.css"><link rel="stylesheet" href="../../../assets/truth-or-dare.css?v=20261011-longplay"><script src="../../../assets/truth-or-dare.js?v=20261011-longplay" defer></script></head>')
    pages[out / 'tools/games/truth-or-dare/index.html'] = party_page
    for ext in ('css', 'js'):
        shutil.copyfile(root / f'tools/truth-or-dare.{ext}', out / f'assets/truth-or-dare.{ext}')
    survey_body = (root / 'tools/surveys.html').read_text(encoding='utf-8')
    survey_page = page('问卷调研', '创建问卷、收集答卷与查询活动反馈', 'tools', survey_body, 2, path='/tools/surveys/', robots='noindex,follow')
    survey_page = survey_page.replace('</head>', '<link rel="stylesheet" href="../../assets/surveys.css?v=20261025-dad-edit"><script src="../../assets/surveys-model.js?v=20261025-dad-edit" defer></script><script src="../../assets/couple-pdf.js?v=20261024" defer></script><script src="../../assets/surveys.js?v=20261107-sql-path" defer></script></head>')
    pages[out / 'tools/surveys/index.html'] = survey_page
    for filename in ('surveys.js', 'surveys-model.js', 'surveys.css'):
        shutil.copyfile(root / 'tools' / filename, out / 'assets' / filename)
    shutil.copyfile(root / 'database/surveys/surveys-schema.sql', sql_assets / 'surveys-schema.sql')
    # Standalone public romance stories; preserve them on future full rebuilds.
    for story_slug in story_slugs:
        story_source = root / 'stories' / (story_slug + '.html')
        if story_source.is_file():
            story_dest = out / 'stories' / story_slug / 'index.html'
            story_dest.parent.mkdir(parents=True, exist_ok=True)
            write_standalone_html(story_source, story_dest)
    static = root / 'static'
    if static.is_dir():
        for source in sorted(static.rglob('*')):
            if source.is_file():
                target = out / source.relative_to(static)
                target.parent.mkdir(parents=True, exist_ok=True)
                if source.suffix.lower() == '.html':
                    write_standalone_html(source, target)
                else:
                    shutil.copyfile(source, target)
    for filename, markup in pages.items():
        filename.parent.mkdir(parents=True, exist_ok=True)
        filename.write_text(markup, encoding='utf-8')
    # Only explicitly public pages belong in the sitemap; new private tools
    # must not become discoverable simply because they have an index.html.
    public = {'/', '/categories/', '/tools/', '/fun/', '/tools/hidden-persona/'}
    for key, category in categories.items():
        public.add(f'/categories/{key}/')
        public.update(f'/categories/{key}/{subkey}/' for subkey in category['subcategories'])
    public.update(f'/articles/{item["slug"]}/' for item in articles)
    public.update(f'/stories/{slug}/' for slug in story_slugs)
    dated = {f'/articles/{item["slug"]}/': item['date'] for item in articles}
    entries = []
    for filename in out.rglob('index.html'):
        parent = filename.parent.relative_to(out).as_posix()
        location = '/' if parent == '.' else f'/{parent}/'
        if location not in public:
            continue
        entries.append(location)
    entries.sort(key=lambda value: (value.count('/'), value))
    sitemap = ['<?xml version="1.0" encoding="UTF-8"?>',
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for location in entries:
        lastmod = f'<lastmod>{dated[location]}</lastmod>' if location in dated else ''
        sitemap.append(f'  <url><loc>{html.escape(absolute(location))}</loc>{lastmod}</url>')
    sitemap.append('</urlset>')
    (out / 'sitemap.xml').write_text('\n'.join(sitemap) + '\n', encoding='utf-8')
    (out / 'robots.txt').write_text(
        'User-agent: *\nAllow: /\n\nSitemap: ' + absolute('/sitemap.xml') + '\n', encoding='utf-8')
    print(f'Built {count} articles in {out}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=root / 'dist')
    args = parser.parse_args()
    build(args.output.resolve())


