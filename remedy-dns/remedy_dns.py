"""Offline DNS inventory normalization and request preview. No network operations."""
import argparse
import hashlib
import ipaddress
import json
import re
import sys


class ValidationError(ValueError):
    pass


def hostname(value):
    if not isinstance(value, str):
        raise ValidationError('DNS names must be strings')
    name = value.lower().rstrip('.')
    if len(name) > 253 or not name or any(
        not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', label)
        for label in name.split('.')
    ):
        raise ValidationError('Invalid DNS hostname')
    return name


def owned(name, domain):
    return name == domain or name.endswith('.' + domain)


def record(raw, domain):
    if not isinstance(raw, dict) or set(raw) - {'name', 'type', 'value', 'ttl'}:
        raise ValidationError('Record supports only name, type, value and optional ttl')
    name = hostname(raw.get('name'))
    if not owned(name, domain):
        raise ValidationError('Record name is outside the selected owned domain')
    kind = raw.get('type')
    value = raw.get('value')
    if not isinstance(kind, str) or not isinstance(value, str):
        raise ValidationError('Record type and value must be strings')
    kind = kind.upper()
    if kind in ('A', 'AAAA'):
        try:
            address = ipaddress.ip_address(value)
        except ValueError:
            raise ValidationError('Invalid IP address') from None
        if address.version != (4 if kind == 'A' else 6):
            raise ValidationError('Address family does not match record type')
        value = str(address)
    elif kind == 'CNAME':
        value = hostname(value)
        if name == domain or value == name:
            raise ValidationError('Apex or self-referencing CNAME is unsupported')
    else:
        raise ValidationError('Only A, AAAA and CNAME are supported in this prototype')
    result = dict(name=name, type=kind, value=value)
    if 'ttl' in raw:
        ttl = raw['ttl']
        if type(ttl) is not int or not 1 <= ttl <= 2147483647:
            raise ValidationError('TTL must be an integer from 1 to 2147483647')
        result['ttl'] = ttl
    return result


def key(item):
    return item['name'], item['type'], item['value']


def inventory(raw, domain):
    if not isinstance(raw, list):
        raise ValidationError('Inventory must be a JSON array of records')
    result = []
    for item in raw:
        normalized = record(item, domain)
        if any(key(old) == key(normalized) for old in result):
            raise ValidationError('Inventory contains duplicate records')
        if any(old['name'] == normalized['name'] and
               ('CNAME' in (old['type'], normalized['type'])) for old in result):
            raise ValidationError('Inventory contains conflicting CNAME records')
        result.append(normalized)
    return sorted(result, key=key)


def preview(candidate, existing, domain):
    candidate = record(candidate, domain)
    for old in existing:
        if key(old) == key(candidate):
            raise ValidationError('Record already exists; review TTL separately')
        if old['name'] == candidate['name'] and (
            old['type'] == candidate['type'] or 'CNAME' in (old['type'], candidate['type'])
        ):
            raise ValidationError('Existing name/type requires operator review')
    digest = hashlib.sha256(json.dumps(candidate, sort_keys=True).encode()).hexdigest()
    return {'state': 'preview_only', 'domain': domain, 'record': candidate,
            'fingerprint': digest,
            'warning': 'Not submitted. Inventory freshness and pending Remedy requests require operator verification.'}


def read(path):
    with open(path, encoding='utf-8') as stream:
        return json.load(stream)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['extract', 'preview'])
    parser.add_argument('--domain', required=True)
    parser.add_argument('--owned-domains', required=True, help='JSON array from an approved ownership source')
    parser.add_argument('--inventory', required=True, help='Adapted JSON export for the selected domain')
    parser.add_argument('--record', help='Candidate JSON record (preview only)')
    args = parser.parse_args()
    try:
        domain = hostname(args.domain)
        domains = read(args.owned_domains)
        if not isinstance(domains, list) or not domains:
            raise ValidationError('Owned domains must be a nonempty JSON array')
        if domain not in [hostname(d) for d in domains]:
            raise ValidationError('Domain must exactly match an approved ownership entry')
        records = inventory(read(args.inventory), domain)
        if args.command == 'preview' and not args.record:
            raise ValidationError('--record is required for preview')
        if args.command == 'extract' and args.record:
            raise ValidationError('--record is only supported for preview')
        result = records if args.command == 'extract' else preview(read(args.record), records, domain)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (ValidationError, OSError, ValueError) as error:
        # Avoid echoing file content, credentials or record values in errors.
        message = str(error) if isinstance(error, ValidationError) else 'Cannot read valid JSON input; check files and permissions'
        print('error: ' + message, file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
