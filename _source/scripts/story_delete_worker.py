"""Process owner-authorized deletion requests for standalone story HTML pages."""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
ENDPOINT = "https://ucautsubldfvxoraeajb.supabase.co/functions/v1/article-deletion-worker"
AUDIENCE = "rain-article-deletion-worker-v1"
STORY_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def delete_story(root: Path, slug: str) -> bool:
    """Remove only one registered story; already-removed requests are idempotent."""
    if not STORY_SLUG.fullmatch(slug) or len(slug) > 80:
        raise ValueError("Invalid story identifier")
    manifest = root / "_source/stories.json"
    catalog = root / "assets/story-catalog.json"
    homepage = root / "index.html"
    source = root / "_source/stories" / (slug + ".html")
    published = root / "stories" / slug / "index.html"
    records = json.loads(manifest.read_text(encoding="utf-8"))
    public_records = json.loads(catalog.read_text(encoding="utf-8"))
    if not isinstance(records, list) or not isinstance(public_records, list):
        raise ValueError("Invalid story catalog")
    matches = [item for item in records if item.get("slug") == slug]
    visible = [item for item in public_records if item.get("slug") == slug]
    if len(matches) > 1 or len(visible) > 1:
        raise ValueError("Duplicate story identifiers")
    if not matches and not visible and not source.exists() and not published.exists():
        return False
    if len(matches) != 1 or len(visible) != 1:
        raise ValueError("Story catalogs do not match; no files were deleted")
    page = homepage.read_text(encoding="utf-8")
    pattern = r'<a class="tile" href="\./stories/' + re.escape(slug) + r'/">.*?</a>'
    updated, removed = re.subn(pattern, "", page, flags=re.DOTALL)
    if removed != 1:
        raise ValueError("Story home link not found uniquely; no files were deleted")
    if len(records) == 1:
        empty = '<section aria-label="恋爱故事"><h2 class="section-title">💜 恋爱小故事</h2><div class="grid"></div></section>'
        if empty not in updated:
            raise ValueError("Story section layout changed; no files were deleted")
        updated = updated.replace(empty, "", 1)
    # Validate all paths before any mutation.
    for path in (manifest, catalog, homepage, source, published):
        if not path.resolve().is_relative_to(root.resolve()):
            raise ValueError("Unsafe story path")
    write_json(manifest, [item for item in records if item.get("slug") != slug])
    write_json(catalog, [item for item in public_records if item.get("slug") != slug])
    homepage.write_text(updated, encoding="utf-8")
    source.unlink(missing_ok=True)
    published.unlink(missing_ok=True)
    return True


def http_json(url: str, headers: dict[str, str], payload=None) -> dict:
    body = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read()
    return json.loads(raw) if raw else {}


def oidc_token() -> str:
    base = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    separator = "&" if "?" in base else "?"
    token_url = base + separator + urllib.parse.urlencode({"audience": AUDIENCE})
    result = http_json(token_url, {"Authorization": "Bearer " + os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]})
    return result["value"]


def worker_call(payload: dict) -> dict:
    return http_json(ENDPOINT, {"Authorization": "Bearer " + oidc_token(), "Content-Type": "application/json"}, payload)


def run_git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, text=True, stdout=subprocess.PIPE).stdout.strip()


def request_build(commit: str) -> None:
    api = "https://api.github.com/repos/" + os.environ["GITHUB_REPOSITORY"] + "/pages/builds"
    headers = {"Authorization": "Bearer " + os.environ["GH_TOKEN"], "Accept": "application/vnd.github+json"}
    http_json(api, headers, {})
    for _ in range(30):
        build = http_json(api + "/latest", headers)
        if build.get("commit") == commit and build.get("status") == "built":
            return
        if build.get("commit") == commit and build.get("status") == "errored":
            raise RuntimeError("GitHub Pages 构建失败")
        time.sleep(5)
    raise RuntimeError("GitHub Pages 尚未完成发布，将自动重试")


def main() -> None:
    if os.environ.get("GITHUB_REF") == "refs/heads/codex/article-deletion":
        if not worker_call({"action": "ping"}).get("ok"):
            raise RuntimeError("Worker authentication check failed")
        print("Development authentication check passed")
        return
    if os.environ.get("GITHUB_REF") != "refs/heads/main":
        raise RuntimeError("Unexpected workflow branch")
    requests = worker_call({"action": "pending"}).get("requests", [])
    if not requests:
        print("No story deletion requests")
        return
    accepted, failed = [], []
    allowed_paths = {"index.html", "_source/stories.json", "assets/story-catalog.json"}
    for request in requests:
        try:
            if request.get("kind") != "story":
                raise ValueError("Only stories are supported")
            slug = request["slug"]
            changed = delete_story(ROOT, slug)
            allowed_paths.update({f"_source/stories/{slug}.html", f"stories/{slug}/index.html"})
            accepted.append(request["id"])
            print("Processed story request; changed:", changed)
        except (ValueError, KeyError, OSError, json.JSONDecodeError) as error:
            failed.append(request["id"])
            print("Skipped invalid or inconsistent story request:", type(error).__name__)
    if failed:
        worker_call({"action": "error", "ids": failed, "message": "故事清单与页面不一致，请检查后重试。"})
    if not accepted:
        return
    try:
        changed_paths = set(filter(None, run_git("diff", "--name-only").splitlines()))
        if not changed_paths.issubset(allowed_paths):
            raise RuntimeError("Unexpected modified file; refusing to push")
        if changed_paths:
            run_git("config", "user.name", "github-actions[bot]")
            run_git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
            run_git("add", "-A", "--", *sorted(changed_paths))
            run_git("diff", "--cached", "--check")
            run_git("commit", "-m", "Remove selected story pages")
            run_git("push", "origin", "HEAD:main")
        commit = run_git("rev-parse", "HEAD")
        request_build(commit)
        worker_call({"action": "complete", "ids": accepted, "commit": commit})
        print("Story deletion and Pages rebuild completed")
    except Exception:
        try:
            worker_call({"action": "error", "ids": accepted, "message": "仓库更新或网页发布未完成，将自动重试。"})
        except Exception:
            pass
        raise


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Story deletion worker failed:", type(error).__name__, file=sys.stderr)
        sys.exit(1)
