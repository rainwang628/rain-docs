"""Generate Open Graph cover images (1200x630) for link previews.

Covers are written to _source/static/assets/og/ so the build copies them to
/assets/og/ on the published site. Run this only when article titles or the
article list change; build.py itself does not need Pillow.

Usage:
    python3 -m pip install pillow   # once
    python3 _source/make_covers.py
"""
from pathlib import Path
import json
import re

from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
out_dir = root / 'static' / 'assets' / 'og'

WIDTH, HEIGHT = 1200, 630
REGULAR = ['/System/Library/Fonts/Hiragino Sans GB.ttc',
           '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
           '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc']
BOLD = ['/System/Library/Fonts/Hiragino Sans GB.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc']


def load_font(candidates, size, bold=False):
    for path in candidates:
        if not Path(path).exists():
            continue
        for index in ([2, 0] if bold else [0]):
            try:
                return ImageFont.truetype(path, size, index=index)
            except OSError:
                continue
    return ImageFont.load_default()


def gradient(top, bottom):
    image = Image.new('RGB', (1, HEIGHT))
    draw = ImageDraw.Draw(image)
    for y in range(HEIGHT):
        t = y / (HEIGHT - 1)
        draw.point((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return image.resize((WIDTH, HEIGHT))


def wrap(text, font, max_width):
    tokens = re.findall(r'[A-Za-z0-9][A-Za-z0-9+#._:/-]*|\s+|.', text)
    lines, current = [], ''
    for token in tokens:
        candidate = current + token
        if font.getlength(candidate) <= max_width or not current:
            current = candidate
        else:
            lines.append(current.rstrip())
            current = token.lstrip()
    if current.strip():
        lines.append(current.rstrip())
    return lines


def draw_card(spec):
    image = gradient(spec['bg_top'], spec['bg_bottom'])
    draw = ImageDraw.Draw(image, 'RGBA')
    for radius, alpha in ((430, 10), (330, 12), (230, 14)):
        draw.ellipse([WIDTH - radius - 40, -180 + (430 - radius), WIDTH + radius - 40, 250 + (430 - radius)],
                     fill=(255, 255, 255, alpha))

    pad = 92
    draw.rectangle([pad, 74, pad + 46, 78], fill=spec['accent'])
    eyebrow = load_font(BOLD, 26, bold=True)
    draw.text((pad, 96), spec['eyebrow'], font=eyebrow, fill=spec['accent'])

    title_size = 70
    while title_size > 44:
        title_font = load_font(BOLD, title_size, bold=True)
        lines = wrap(spec['title'], title_font, WIDTH - pad * 2)
        if len(lines) <= 3:
            break
        title_size -= 4
    body_font = load_font(REGULAR, 30)
    desc_lines = wrap(spec['description'], body_font, WIDTH - pad * 2)[:2]

    block = len(lines) * int(title_size * 1.32) + 26 + len(desc_lines) * 44
    y = (HEIGHT - block) // 2 + 34
    for line in lines:
        draw.text((pad, y), line, font=title_font, fill=(255, 255, 255))
        y += int(title_size * 1.32)
    y += 26
    for line in desc_lines:
        draw.text((pad, y), line, font=body_font, fill=(183, 203, 211))
        y += 44

    if spec.get('tag'):
        tag_font = load_font(REGULAR, 26)
        draw.text((pad, HEIGHT - 96), spec['tag'], font=tag_font, fill=(140, 172, 182))

    out_dir.mkdir(parents=True, exist_ok=True)
    image.quantize(colors=256, method=Image.Quantize.MEDIANCUT).save(out_dir / f'{spec["slug"]}.png', optimize=True)
    return out_dir / f'{spec["slug"]}.png'


def main():
    categories = json.loads((root / 'categories.json').read_text(encoding='utf-8'))
    articles = json.loads((root / 'articles.json').read_text(encoding='utf-8'))
    specs = [{
        'slug': 'home', 'title': '文档与笔记', 'eyebrow': 'RAIN / PERSONAL NOTES',
        'description': '整理日常遇到的问题和已经验证的做法：AI 工具、Mac 使用、浏览器与云端数据库。',
        'tag': 'rain 的文档', 'accent': '#7fd1b9', 'bg_top': (28, 48, 64), 'bg_bottom': (36, 69, 90),
    }]
    for item in articles:
        category = categories[item['category']]
        sub = category['subcategories'][item['subcategory']]
        specs.append({
            'slug': item['slug'], 'title': item['title'],
            'eyebrow': (category['title'] + ' / ' + sub['title']).upper(),
            'description': item['description'], 'tag': item['date'],
            'accent': '#7fd1b9', 'bg_top': (28, 48, 64), 'bg_bottom': (36, 69, 90),
        })
    specs.append({
        'slug': 'story-infj-enfp', 'title': '当快乐小狗，遇见小老头',
        'eyebrow': 'INFJ × ENFP · 恋爱六幕',
        'description': '从初识、暧昧到争吵、相守，六幕长篇故事，读懂 INFJ 与 ENFP 截然不同的心动方式。',
        'tag': 'rain 的文档', 'accent': '#c9b6ff', 'bg_top': (33, 27, 58), 'bg_bottom': (58, 44, 92),
    })
    specs.append({
        'slug': 'hidden-persona', 'title': '八仙反差人格测试',
        'eyebrow': '测评 / 八仙人格',
        'description': '12 道情境题，找到你最像的八仙人物原型，生成专属国风分享卡。',
        'tag': '凭专属体验码参与', 'accent': '#e8c98a', 'bg_top': (52, 42, 32), 'bg_bottom': (88, 68, 46),
    })
    for spec in specs:
        print('wrote', draw_card(spec))


if __name__ == '__main__':
    main()
