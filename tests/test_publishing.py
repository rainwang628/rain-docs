import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest


SOURCE = Path(__file__).resolve().parents[1]


class PublishingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / 'site'
        shutil.copytree(SOURCE, self.root, ignore=shutil.ignore_patterns('.git', '__pycache__'))

    def tearDown(self):
        self.tmp.cleanup()

    def run_publish(self, *args):
        return subprocess.run([sys.executable, '_source/publish.py', *args], cwd=self.root,
                              text=True, capture_output=True)

    def remove_article(self):
        path = self.root / '_source/articles.json'
        articles = json.loads(path.read_text(encoding='utf-8'))
        path.write_text(json.dumps([a for a in articles if a['slug'] != 'mac-usage-notes'],
                                   ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    def test_removed_article_cleans_only_unmodified_generated_files(self):
        self.remove_article()
        extra = self.root / 'unmanaged-note.txt'
        extra.write_text('keep me', encoding='utf-8')
        preview = self.run_publish('--check')
        self.assertNotEqual(preview.returncode, 0)
        self.assertIn('remove articles/mac-usage-notes/index.html', preview.stdout)
        self.assertTrue((self.root / 'articles/mac-usage-notes/index.html').exists())
        published = self.run_publish()
        self.assertEqual(published.returncode, 0, published.stderr)
        for path in ('articles/mac-usage-notes/index.html', 'mac-usage-notes.md',
                     'source/mac-usage-notes.md'):
            self.assertFalse((self.root / path).exists(), path)
        self.assertTrue((self.root / '_source/content/mac-usage-notes.md').exists())
        self.assertEqual(extra.read_text(), 'keep me')
        self.assertEqual(self.run_publish('--check').returncode, 0)

    def test_modified_stale_file_is_not_deleted_or_overwritten(self):
        self.remove_article()
        page = self.root / 'articles/mac-usage-notes/index.html'
        page.write_text('manual change', encoding='utf-8')
        homepage = (self.root / 'index.html').read_bytes()
        result = self.run_publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('refusing to remove a modified generated file', result.stderr)
        self.assertEqual(page.read_text(), 'manual change')
        self.assertEqual((self.root / 'index.html').read_bytes(), homepage)

    def test_manifest_cannot_remove_source_or_escape_repository(self):
        manifest_path = self.root / '_source/generated-files.json'
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        source = self.root / '_source/content/mac-usage-notes.md'
        before = source.read_bytes()
        manifest['files']['_source/content/mac-usage-notes.md'] = '0' * 64
        manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
        result = self.run_publish()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Unsafe generated file path', result.stderr)
        self.assertEqual(source.read_bytes(), before)

    def test_private_pages_are_not_indexed_or_listed(self):
        sitemap = (self.root / 'sitemap.xml').read_text(encoding='utf-8')
        for path in ('tools/nutrition/', 'tools/games/',
                     'tools/games/truth-or-dare/', 'tools/games/uno-costume/'):
            head = (self.root / path / 'index.html').read_text(encoding='utf-8').split('</head>')[0]
            self.assertIn('name="robots" content="noindex,follow"', head, path)
            self.assertNotIn('/rain-docs/' + path + '</loc>', sitemap)
        self.assertIn('/rain-docs/tools/hidden-persona/</loc>', sitemap)
        self.assertIn('/rain-docs/articles/mac-usage-notes/</loc>', sitemap)

    def test_domain_change_updates_standalone_metadata_and_json_ld(self):
        config = self.root / '_source/site.json'
        site = json.loads(config.read_text(encoding='utf-8'))
        site['base_url'] = 'https://example.test/new-path'
        config.write_text(json.dumps(site), encoding='utf-8')
        result = self.run_publish()
        self.assertEqual(result.returncode, 0, result.stderr)
        for name in ('index.html', 'stories/infj-enfp/index.html',
                     'tools/hidden-persona/index.html', 'tools/nutrition/index.html',
                     'tools/games/uno-costume/index.html'):
            head = (self.root / name).read_text(encoding='utf-8').split('</head>')[0]
            self.assertNotIn('https://rainwang628.github.io/rain-docs', head, name)
            self.assertIn('https://example.test/new-path', head, name)
            for script in re.findall(r'<script type="application/ld\+json">(.*?)</script>', head):
                json.loads(script)

    def test_story_deletion_keeps_sitemap_and_manifest_in_sync(self):
        spec = importlib.util.spec_from_file_location('story_worker_test',
                                                     self.root / '_source/scripts/story_delete_worker.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertTrue(module.delete_story(self.root, 'infj-enfp'))
        self.assertFalse((self.root / 'stories/infj-enfp/index.html').exists())
        self.assertNotIn('/stories/infj-enfp/', (self.root / 'sitemap.xml').read_text(encoding='utf-8'))
        manifest = json.loads((self.root / '_source/generated-files.json').read_text(encoding='utf-8'))
        self.assertNotIn('stories/infj-enfp/index.html', manifest['files'])
        result = self.run_publish('--check')
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_build_refuses_to_overwrite_repository(self):
        marker = self.root / 'do-not-delete.txt'
        marker.write_text('safe', encoding='utf-8')
        result = subprocess.run([sys.executable, '_source/build.py', '--output', str(self.root)],
                                cwd=self.root, text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(marker.read_text(), 'safe')


if __name__ == '__main__':
    unittest.main()
