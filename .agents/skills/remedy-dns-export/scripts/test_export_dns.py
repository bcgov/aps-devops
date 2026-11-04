import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from export_dns import HEADERS, convert, combine


class ExportTests(unittest.TestCase):
    def row(self, name='@', kind='A', data='192.0.2.1', domain='example.test'):
        return ['Active', 'Team', name, domain, kind, '300', 'Public', '', '', '', data, 'No', 'operator', 'date']

    def test_preserves_special_names_and_multiple_addresses(self):
        rows = [HEADERS, self.row(), self.row('*'), self.row('_dmarc', 'TXT', 'v=DMARC1; p=reject;'), self.row(data='192.0.2.2')]
        result = convert(rows, 'example.test', 4)
        self.assertEqual(len(result['records']), 4)
        self.assertEqual(result['records'][2]['data'], 'v=DMARC1; p=reject;')
        self.assertEqual(result['records'][0]['port'], '')
        self.assertNotIn('operator', str(result))

    def test_exact_domain_filter(self):
        result = convert([HEADERS, self.row(), self.row(domain='example.test.other')], 'EXAMPLE.TEST.', 2)
        self.assertEqual(result['exported_record_count'], 1)
        self.assertEqual(result['excluded_record_count'], 1)

    def test_rejects_incomplete_or_changed_layout(self):
        for rows, total in [([HEADERS, self.row()], 2), ([HEADERS[:-1]], 0), ([HEADERS, self.row()[:-1]], 1)]:
            with self.assertRaises(ValueError):
                convert(rows, 'example.test', total)

    def test_family_combines_domains_without_deduplicating_names(self):
        domains = ['api.gov.bc.ca', 'dev.api.gov.bc.ca', 'test.api.gov.bc.ca']
        captures = [dict(domain=d, expected_total=1, rows=[HEADERS, self.row(domain=d)]) for d in domains]
        result = combine(captures, 'api.gov.bc.ca')
        self.assertEqual(result['exported_record_count'], 3)
        self.assertEqual([r['domain'] for r in result['records']], domains)
        self.assertEqual(len(result['searches']), 3)
        for invalid in [captures[:2], [captures[0]] * 3,
                        captures[:2] + [dict(domain=domains[2], expected_total=2, rows=[HEADERS])]]:
            with self.assertRaises(ValueError):
                combine(invalid, 'api.gov.bc.ca')

    def test_empty_export(self):
        self.assertEqual(convert([HEADERS], 'example.test', 0)['records'], [])

    def test_cli_writes_csv_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / '.git').mkdir()
            rows = repo / 'rows.json'
            rows.write_text(json.dumps([HEADERS, self.row()]))
            subprocess.run([sys.executable, str(Path(__file__).with_name('export_dns.py')), '--rows', str(rows),
                            '--domain', 'example.test', '--expected-total', '1', '--repo', str(repo)],
                           check=True, capture_output=True)
            self.assertEqual((repo / 'dns' / 'example.test.csv').read_bytes().count(b'\r'), 0)
            self.assertEqual([p.name for p in (repo / 'dns').iterdir()], ['example.test.csv'])
            self.assertIn('192.0.2.1', (repo / 'dns' / 'example.test.csv').read_text())


if __name__ == '__main__':
    unittest.main()
