#!/usr/bin/env python3
"""Apply ticket changes to an editable D2 template; emit the same rows as JSON."""
import argparse
import json
from pathlib import Path
import re


def prepare(template, registry, change_map):
    components = registry['components']
    ids = [c['id'] for c in components]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate IDs in master component list')
    if any(not re.fullmatch(r'[a-z][a-z0-9_]*', cid) for cid in ids):
        raise ValueError('Use lowercase letters, digits and underscores for IDs')
    master = {c['id']: c for c in components}
    # Repository-only rows cover work with no suitable master component.
    repositories = {c['repository'] for c in components if c['repository'] != 'external'}
    repo_nodes = {'repo_' + re.sub(r'[^a-z0-9_]', '_', repo): repo for repo in repositories}
    declared = set(re.findall(r'^([a-z][a-z0-9_]*)\s*:', template, re.M)) - {'direction', 'classes', 'vars', 'grid_rows', 'grid_columns'}
    unknown = declared - master.keys() - repo_nodes.keys()
    if unknown:
        raise ValueError(f'Template has unregistered components: {sorted(unknown)}')
    rows, overrides, seen = [], [], set()
    kinds = {'modify', 'add', 'remove', 'uncertain'}
    for cid in sorted(declared):
        label = master[cid]['label'] if cid in master else repo_nodes[cid]
        overrides.append(f'{cid}.label: {json.dumps(label)}')
    for change in change_map['changes']:
        if 'id' in change:
            cid = change['id']
            if cid not in master:
                raise ValueError(f'Unknown master component: {cid}; use subcomponent or a repository-only row')
            if any(key in change for key in ('label', 'repository', 'path', 'purpose')):
                raise ValueError(f'{cid}: component metadata must come from the master list')
            metadata = dict(master[cid], scope='component')
        elif 'repository' in change:
            repo = change['repository']
            if repo not in repositories:
                raise ValueError(f'Unknown repository: {repo}')
            cid = 'repo_' + re.sub(r'[^a-z0-9_]', '_', repo)
            metadata = dict(id=cid, label=repo, repository=repo, path=None, scope='repository')
            if any(key in change for key in ('label', 'path', 'purpose')):
                raise ValueError('Repository rows cannot override component metadata')
        else:
            raise ValueError('Each change needs a master id or repository')
        kind = change['kind']
        if cid in seen:
            raise ValueError(f'Duplicate change: {cid}; combine subcomponents under its parent')
        seen.add(cid)
        if cid not in declared:
            raise ValueError(f'Place {cid} as a top-level node in the template first')
        if kind not in kinds:
            raise ValueError(f'Unsupported change kind: {kind}')
        if not change.get('summary') or not change.get('validation'):
            raise ValueError(f'{cid} needs summary and planned validation')
        if 'subcomponent' in change and not isinstance(change['subcomponent'], str):
            raise ValueError('subcomponent must be a text description')
        rows.append({**change, **metadata})
        overrides.append(f'{cid}.class: {kind}')
    overrides.append('proposal_legend: "Legend: amber solid = expected change | green = new | red dashed = removal | amber dashed = agreement needed | gray = context" {shape: text; style.font-size: 13}')
    return template + '\n# Generated ticket overlay; edit the template/change map instead.\n' + '\n'.join(overrides) + '\n', rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--template', type=Path, required=True)
    parser.add_argument('--components', type=Path, required=True)
    parser.add_argument('--changes', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    summary = args.output.with_suffix('.summary.json')
    inputs = {p.resolve() for p in (args.template, args.components, args.changes)}
    if args.output.resolve() in inputs or summary.resolve() in inputs:
        parser.error('Outputs must not overwrite inputs')
    try:
        diagram, rows = prepare(args.template.read_text(), json.loads(args.components.read_text()), json.loads(args.changes.read_text()))
    except (ValueError, KeyError) as error:
        parser.error(str(error))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(diagram)
    summary.write_text(json.dumps(rows, indent=2) + '\n')
    print(f'Prepared {args.output} and {summary}')


if __name__ == '__main__':
    main()
