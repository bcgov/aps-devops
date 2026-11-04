import unittest
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import remedy_dns as dns


class ValidationTests(unittest.TestCase):
    domain = 'example.test'

    def item(self, **changes):
        return dict(dict(name='api.example.test', type='A', value='192.0.2.1', ttl=300), **changes)

    def test_normalization_and_stable_preview(self):
        first = dns.preview(self.item(name='API.EXAMPLE.TEST.'), [], self.domain)
        second = dns.preview(self.item(), [], self.domain)
        self.assertEqual(first, second)
        self.assertEqual(first['state'], 'preview_only')

    def test_invalid_records(self):
        for changes in [dict(name='example.test.evil.test'), dict(type='AAAA'),
                        dict(ttl=True), dict(ttl=0), dict(name='bad..example.test'),
                        dict(type='TXT'), dict(value=None), dict(type='CNAME', value='api.example.test'),
                        dict(type='CNAME', name='example.test', value='target.test')]:
            with self.subTest(changes=changes), self.assertRaises(dns.ValidationError):
                dns.record(self.item(**changes), self.domain)

    def test_existing_and_conflicting_records(self):
        old = dns.record(self.item(), self.domain)
        for candidate in [self.item(), self.item(value='192.0.2.2'),
                          self.item(type='CNAME', value='target.test')]:
            with self.subTest(candidate=candidate), self.assertRaises(dns.ValidationError):
                dns.preview(candidate, [old], self.domain)

    def test_inventory_rejects_duplicates_and_cname_conflicts(self):
        for records in [[self.item(), self.item()],
                        [self.item(), self.item(type='CNAME', value='target.test')]]:
            with self.assertRaises(dns.ValidationError):
                dns.inventory(records, self.domain)

    def test_cli_ownership_and_preview(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, data in [('owned', [self.domain]), ('inventory', []), ('record', self.item())]:
                (root / (name + '.json')).write_text(json.dumps(data))
            command = [sys.executable, str(Path(dns.__file__)), 'preview',
                       '--domain', self.domain, '--owned-domains', str(root / 'owned.json'),
                       '--inventory', str(root / 'inventory.json'), '--record', str(root / 'record.json')]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)['state'], 'preview_only')
            (root / 'owned.json').write_text('["other.test"]')
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertEqual(result.stdout, '')
            self.assertIn('approved ownership', result.stderr)
            (root / 'owned.json').write_text('not-json')
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertNotIn('not-json', result.stderr)

    def test_ipv6_normalization(self):
        item = dns.record(self.item(type='AAAA', value='2001:db8:0:0::1'), self.domain)
        self.assertEqual(item['value'], '2001:db8::1')

    def test_rejects_unknown_fields(self):
        with self.assertRaises(dns.ValidationError):
            dns.record(self.item(password='not-for-export'), self.domain)


if __name__ == '__main__':
    unittest.main()
