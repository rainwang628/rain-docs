import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "_source/scripts/story_delete_worker.py"
spec = importlib.util.spec_from_file_location("story_delete_worker", MODULE_PATH)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StoryDeletionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for folder in ("_source/stories", "assets", "stories/one", "stories/two", "_source/content"):
            (self.root / folder).mkdir(parents=True, exist_ok=True)
        stories = [{"slug":"one","title":"One"},{"slug":"two","title":"Two"}]
        for path in ("_source/stories.json", "assets/story-catalog.json"):
            (self.root / path).write_text(json.dumps(stories), encoding="utf-8")
        (self.root / "index.html").write_text(
            '<section aria-label="恋爱故事"><h2 class="section-title">💜 恋爱小故事</h2><div class="grid">'
            '<a class="tile" href="./stories/one/">One</a>'
            '<a class="tile" href="./stories/two/">Two</a></div></section>',
            encoding="utf-8")
        for slug in ("one","two"):
            (self.root / "_source/stories" / (slug+".html")).write_text(slug,encoding="utf-8")
            (self.root / "stories" / slug / "index.html").write_text(slug,encoding="utf-8")
        (self.root / "_source/content/technical.md").write_text("keep",encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def test_deleting_story_leaves_other_story_and_technical_markdown(self):
        self.assertTrue(module.delete_story(self.root,"one"))
        self.assertFalse((self.root/"_source/stories/one.html").exists())
        self.assertFalse((self.root/"stories/one/index.html").exists())
        self.assertTrue((self.root/"stories/two/index.html").exists())
        self.assertEqual((self.root/"_source/content/technical.md").read_text(),"keep")
        self.assertNotIn("./stories/one/",(self.root/"index.html").read_text())
        self.assertIn("./stories/two/",(self.root/"index.html").read_text())
        self.assertEqual([x["slug"] for x in json.loads((self.root/"_source/stories.json").read_text())],["two"])
        self.assertFalse(module.delete_story(self.root,"one"))

    def test_delete_last_story_removes_empty_section(self):
        module.delete_story(self.root,"one")
        module.delete_story(self.root,"two")
        self.assertNotIn('aria-label="恋爱故事"',(self.root/"index.html").read_text())

    def test_invalid_or_unregistered_story_cannot_delete_files(self):
        before=(self.root/"index.html").read_text()
        with self.assertRaises(ValueError):
            module.delete_story(self.root,"../technical")
        (self.root/"_source/stories/unknown.html").write_text("unregistered")
        with self.assertRaises(ValueError):
            module.delete_story(self.root,"unknown")
        self.assertEqual((self.root/"index.html").read_text(),before)
        self.assertEqual((self.root/"_source/content/technical.md").read_text(),"keep")

    def test_mismatched_catalog_aborts_before_mutation(self):
        (self.root/"assets/story-catalog.json").write_text("[]")
        with self.assertRaises(ValueError):
            module.delete_story(self.root,"one")
        self.assertTrue((self.root/"stories/one/index.html").exists())
        self.assertTrue((self.root/"_source/stories/one.html").exists())

if __name__ == "__main__":
    unittest.main()
