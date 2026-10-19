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
    rows, overrides, seen = [], [], set()
    tags = {'modify': 'CHANGE', 'add': 'NEW', 'remove': 'REMOVE', 'uncertain': 'TBC'}
    for change in change_map['changes']:
        cid, kind = change['id'], change['kind']
        if cid in seen:
            raise ValueError(f'Duplicate change: {cid}')
        seen.add(cid)
        if cid not in master:
            raise ValueError(f'Add {cid} to master-components.json first')
        if not re.search(r'^' + re.escape(cid) + r'\s*:', template, re.M):
            raise ValueError(f'Place {cid} as a top-level node in the template first')
        if kind not in tags:
            raise ValueError(f'Unsupported change kind: {kind}')
        if not change.get('summary') or not change.get('validation'):
            raise ValueError(f'{cid} needs summary and planned validation')
        row = {**master[cid], **change}
        rows.append(row)
        overrides.extend([f'{cid}.class: {kind}',
                          f'{cid}.label: {json.dumps(master[cid]["label"])}'])
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
