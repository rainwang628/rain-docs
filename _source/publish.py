"""Build the site and copy the result over the repository root.

The repository root is the published site (GitHub Pages serves it directly),
so it is treated as generated output: never edit files there by hand.

Usage:
    python3 _source/publish.py           # build and write to the repository root
    python3 _source/publish.py --check   # report what would change, write nothing
"""
from pathlib import Path
import subprocess
import sys
import tempfile

repo = Path(__file__).resolve().parent.parent


def main():
    check = '--check' in sys.argv[1:]
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, str(repo / '_source' / 'build.py'), '--output', tmp], check=True)
        built = Path(tmp)
        changed = []
        for source in sorted(built.rglob('*')):
            if not source.is_file():
                continue
            rel = source.relative_to(built)
            target = repo / rel
            if target.exists() and target.read_bytes() == source.read_bytes():
                continue
            changed.append(rel)
            if not check:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(source.read_bytes())
        verb = 'would change' if check else 'wrote'
        print(f'{verb} {len(changed)} files')
        for rel in changed:
            print(f'  {rel}')
        if check and changed:
            sys.exit(1)


if __name__ == '__main__':
    main()
