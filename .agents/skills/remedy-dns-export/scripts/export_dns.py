"""Validate captured Remedy table rows and save lossless DNS-field CSV snapshots."""
import argparse
import csv
import io
import json
import re
from pathlib import Path

HEADERS = ['Entry Status', 'Assigned Admin Group', 'Hostname', 'Domain', 'Type',
           'TTL', 'View', 'Port', 'Priority', 'Weight', 'Data', 'PTR in DNS',
           'Modified By User', 'User Modified Date']
FIELDS = ['entry_status', 'assigned_admin_group', 'hostname', 'domain', 'type',
          'ttl', 'view', 'port', 'priority', 'weight', 'data', 'ptr_in_dns']


def convert(rows, domain, total):
    domain = domain.lower().removesuffix('.')
    if not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', domain) or any(
        not label or len(label) > 63 or label.startswith('-') or label.endswith('-')
        for label in domain.split('.')
    ) or len(domain) > 253:
        raise ValueError('Invalid domain')
    if not isinstance(rows, list) or not rows or not isinstance(rows[0], list):
        raise ValueError('Expected header and data row array')
    if [h.lstrip('+') for h in rows[0]] != HEADERS:
        raise ValueError('Unexpected table columns; inspect current Remedy layout')
    if total < 0 or len(rows) - 1 != total:
        raise ValueError('Loaded row count differs from displayed total')
    records = []
    excluded = 0
    for row in rows[1:]:
        if not isinstance(row, list) or len(row) != len(HEADERS) or any(not isinstance(v, str) for v in row):
            raise ValueError('Malformed table row')
        if row[3].lower().removesuffix('.') != domain:
            excluded += 1
            continue
        item = dict(zip(FIELDS, row[:12]))
        if not re.fullmatch(r'[0-9]+', item['ttl']):
            raise ValueError('Unexpected TTL; preserve raw capture and inspect')
        item['ttl'] = int(item['ttl'])
        records.append(item)
    return dict(domain=domain, source='Remedy NNR:dlg DNS Search and Edit, loaded Quick Search results',
                search=domain, displayed_result_count=total, exported_record_count=len(records),
                excluded_record_count=excluded,
                scope='DNS fields from loaded table; user audit columns omitted; snapshot, not live DNS verification',
                records=records)


def combine(captures, family):
    if family not in ('api.gov.bc.ca', 'apps.gov.bc.ca'):
        raise ValueError('Unknown domain family')
    domains = [family, 'dev.' + family, 'test.' + family]
    if not isinstance(captures, list) or len(captures) != 3:
        raise ValueError('A family export requires all three domain captures')
    by_domain = {}
    for capture in captures:
        snapshot = convert(capture['rows'], capture['domain'], capture['expected_total'])
        domain = snapshot['domain']
        if domain not in domains or domain in by_domain:
            raise ValueError('Unexpected or duplicate domain capture')
        by_domain[domain] = snapshot
    if set(by_domain) != set(domains):
        raise ValueError('Missing domain capture')
    ordered = [by_domain[d] for d in domains]
    return dict(domain=family, domains=domains, source=ordered[0]['source'],
                searches=[{k: item[k] for k in ('domain', 'displayed_result_count',
                          'exported_record_count', 'excluded_record_count')} for item in ordered],
                exported_record_count=sum(item['exported_record_count'] for item in ordered),
                excluded_record_count=sum(item['excluded_record_count'] for item in ordered),
                scope=ordered[0]['scope'],
                records=[record for item in ordered for record in item['records']])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rows', type=Path)
    parser.add_argument('--captures', type=Path, help='JSON array of domain, expected_total and rows for all three family domains')
    parser.add_argument('--domain', required=True)
    parser.add_argument('--expected-total', type=int)
    parser.add_argument('--repo', type=Path, required=True)
    args = parser.parse_args()
    if not (args.repo / '.git').exists():
        parser.error('--repo must be a Git checkout or worktree')
    try:
        if args.captures:
            if args.rows or args.expected_total is not None:
                raise ValueError('Use --captures alone for grouped input')
            snapshot = combine(json.loads(args.captures.read_text()), args.domain)
        else:
            if not args.rows or args.expected_total is None:
                raise ValueError('--rows and --expected-total are required for single-domain input')
            snapshot = convert(json.loads(args.rows.read_text()), args.domain, args.expected_total)
    except (OSError, ValueError, TypeError, AttributeError, KeyError) as error:
        parser.error(str(error))
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=FIELDS, lineterminator='\n')
    writer.writeheader()
    writer.writerows(snapshot['records'])
    csv_text = stream.getvalue()
    assert list(csv.DictReader(io.StringIO(csv_text))) == [
        {k: str(v) for k, v in row.items()} for row in snapshot['records']]
    folder = args.repo / 'dns'
    folder.mkdir(exist_ok=True)
    with open(folder / (snapshot['domain'] + '.csv'), 'w', newline='') as handle:
        handle.write(csv_text)
    print(f"Exported {snapshot['exported_record_count']} records; excluded {snapshot['excluded_record_count']}")


if __name__ == '__main__':
    main()
