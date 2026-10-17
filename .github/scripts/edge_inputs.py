#!/usr/bin/env python3
"""Resolve a plugin bundle tag (or full commit) before building an edge image."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess


def resolve(ref):
    if re.fullmatch(r'[0-9a-f]{40}', ref):
        return ref
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/-]*', ref):
        raise ValueError('Plugins reference must be a full commit or a Git tag')
    subprocess.run(['git', 'check-ref-format', 'refs/tags/' + ref], check=True)
    output = subprocess.check_output(['git', 'ls-remote', 'https://github.com/bcgov/kong-oss-plugins.git',
                                      'refs/tags/' + ref, 'refs/tags/' + ref + '^{}'], text=True)
    refs = {name: sha for sha, name in (line.split() for line in output.splitlines())}
    revision = refs.get('refs/tags/' + ref + '^{}', refs.get('refs/tags/' + ref))
    if not revision or not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Plugins tag does not exist; branch names are not accepted')
    return revision


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--plugins-ref', default='')
    args = parser.parse_args()
    lock = json.loads(Path('sdx/image/plugins.json').read_text())
    ref = args.plugins_ref or lock['ref']
    revision = resolve(ref)
    if not args.plugins_ref and revision != lock['revision']:
        raise ValueError('The configured plugin tag moved; review the lock file before building')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a') as stream:
            stream.write(f'plugins_ref={ref}\nplugins_revision={revision}\n')
    print(json.dumps({'ref': ref, 'revision': revision}))


if __name__ == '__main__':
    main()
