"""Build and safely synchronize the generated GitHub Pages files.

Usage:
    python3 _source/publish.py           # build and synchronize the site
    python3 _source/publish.py --check   # preview changes without writing
"""
from hashlib import sha256
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile

repo = Path(__file__).resolve().parent.parent
manifest = repo / '_source' / 'generated-files.json'
reserved = {'.git', '.github', '_source', 'tests', 'supabase'}


def target_for(name):
    """Reject unsafe manifest entries before touching any repository files."""
    if not isinstance(name, str) or not name or '\\' in name:
        raise ValueError('Invalid generated file path')
    rel = PurePosixPath(name)
    if (rel.is_absolute() or rel.as_posix() != name or '..' in rel.parts
            or not rel.parts or rel.parts[0] in reserved):
        raise ValueError('Unsafe generated file path: ' + name)
    target = repo.joinpath(*rel.parts)
    if not target.resolve().is_relative_to(repo.resolve()):
        raise ValueError('Generated file path escapes repository: ' + name)
    if any(path.is_symlink() for path in (target, *target.parents) if path != repo):
        raise ValueError('Generated file path contains a symlink: ' + name)
    return target


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def manifest_text(files):
    return json.dumps({'version': 1, 'files': dict(sorted(files.items()))},
                      ensure_ascii=False, indent=2) + '\n'


def main():
    check = '--check' in sys.argv[1:]
    if manifest.exists():
        old = json.loads(manifest.read_text(encoding='utf-8'))
        if old.get('version') != 1 or not isinstance(old.get('files'), dict):
            raise ValueError('Invalid generated file manifest')
        previous = old['files']
    else:
        # A first run records existing outputs; it never guesses what to delete.
        previous = {}
    for name, value in previous.items():
        target_for(name)
        if not isinstance(value, str) or len(value) != 64 or any(c not in '0123456789abcdef' for c in value):
            raise ValueError('Invalid generated file digest: ' + name)

    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, str(repo / '_source' / 'build.py'), '--output', tmp], check=True)
        built = Path(tmp)
        generated = {p.relative_to(built).as_posix(): p for p in built.rglob('*') if p.is_file()}
        current = {name: digest(source) for name, source in generated.items()}
        targets = {name: target_for(name) for name in set(previous) | set(current)}
        changed = sorted(name for name, value in current.items()
                         if not targets[name].is_file() or digest(targets[name]) != value)
        stale = sorted(set(previous) - set(current))
        conflicts = [name for name in stale if targets[name].exists()
                     and (not targets[name].is_file() or digest(targets[name]) != previous[name])]
        if conflicts:
            for name in conflicts:
                print('refusing to remove a modified generated file:', name, file=sys.stderr)
            return 1
        desired_manifest = manifest_text(current)
        manifest_changed = (not manifest.exists() or
                            manifest.read_text(encoding='utf-8') != desired_manifest)
        print(f'{"would write" if check else "writing"} {len(changed)} files; '
              f'{"would remove" if check else "removing"} {len(stale)} stale files')
        for name in changed:
            print('  write ', name)
        for name in stale:
            print('  remove', name)
        if manifest_changed:
            print('  update _source/generated-files.json')
        if check:
            return int(bool(changed or stale or manifest_changed))
        for name in changed:
            target = targets[name]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(generated[name].read_bytes())
        for name in stale:
            targets[name].unlink(missing_ok=True)
        if manifest_changed:
            manifest.write_text(desired_manifest, encoding='utf-8')
    return 0


if __name__ == '__main__':
    sys.exit(main())
