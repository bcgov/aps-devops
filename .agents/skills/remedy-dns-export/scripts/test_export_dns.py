import unittest
from export_dns import HEADERS, convert


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

    def test_empty_export(self):
        self.assertEqual(convert([HEADERS], 'example.test', 0)['records'], [])


if __name__ == '__main__':
    unittest.main()
