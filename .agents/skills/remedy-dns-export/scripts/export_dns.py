"""Validate captured Remedy table rows and save lossless DNS-field snapshots."""
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rows', type=Path, required=True)
    parser.add_argument('--domain', required=True)
    parser.add_argument('--expected-total', type=int, required=True)
    parser.add_argument('--repo', type=Path, required=True)
    args = parser.parse_args()
    if not (args.repo / '.git').exists():
        parser.error('--repo must be a Git checkout or worktree')
    try:
        snapshot = convert(json.loads(args.rows.read_text()), args.domain, args.expected_total)
    except (OSError, ValueError, TypeError, AttributeError) as error:
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
    (folder / (snapshot['domain'] + '.csv')).write_text(csv_text, newline='')
    (folder / (snapshot['domain'] + '.json')).write_text(json.dumps(snapshot, indent=2) + '\n')
    print(f"Exported {snapshot['exported_record_count']} records; excluded {snapshot['excluded_record_count']}")


if __name__ == '__main__':
    main()
