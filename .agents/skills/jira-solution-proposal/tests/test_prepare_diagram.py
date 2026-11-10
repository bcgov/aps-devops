import copy
import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('prepare_diagram', Path(__file__).parents[1] / 'scripts/prepare_diagram.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ComponentIdentityTests(unittest.TestCase):
    def setUp(self):
        self.registry = {'components': [dict(id='portal', label='API Services Portal', repository='api-services-portal', path='src')]}
        self.template = 'direction: right\nportal: Old label {class: context}\n'
        self.change = dict(id='portal', kind='modify', subcomponent='Subsystem / CSS association', summary='Enforce mapping.', validation='Conflicting writes.')

    def test_parent_identity_is_preserved_and_subcomponent_stays_summary_only(self):
        original = copy.deepcopy(self.registry)
        diagram, rows = module.prepare(self.template, self.registry, {'changes': [self.change]})
        self.assertIn('portal.label: "API Services Portal"', diagram)
        self.assertNotIn(self.change['subcomponent'], diagram)
        self.assertEqual(rows[0]['subcomponent'], self.change['subcomponent'])
        self.assertEqual(rows[0]['repository'], 'api-services-portal')
        self.assertEqual(rows[0]['proposed_change'], 'Subsystem / CSS association: Enforce mapping.')
        self.assertEqual(self.registry, original)

    def test_component_metadata_cannot_be_overridden(self):
        for key in ('label', 'repository', 'path', 'purpose'):
            with self.subTest(key=key), self.assertRaises(ValueError):
                module.prepare(self.template, self.registry, {'changes': [{**self.change, key: 'invented'}]})

    def test_unregistered_template_nodes_are_rejected_even_without_changes(self):
        with self.assertRaisesRegex(ValueError, 'unregistered'):
            module.prepare(self.template + 'association: Invented component\n', self.registry, {'changes': []})

    def test_unknown_component_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unknown master component'):
            module.prepare(self.template, self.registry, {'changes': [{**self.change, 'id': 'association'}]})

    def test_repository_only_work_does_not_invent_component(self):
        template = 'repo_api_services_portal: api-services-portal\n'
        change = {k: v for k, v in self.change.items() if k != 'id'}
        change['repository'] = 'api-services-portal'
        diagram, rows = module.prepare(template, self.registry, {'changes': [change]})
        self.assertEqual(rows[0]['scope'], 'repository')
        self.assertEqual(rows[0]['label'], 'api-services-portal')
        self.assertNotIn(change['subcomponent'], diagram)

    def test_duplicate_parents_are_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate change'):
            module.prepare(self.template, self.registry, {'changes': [self.change, self.change]})

    def test_unknown_repository_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unknown repository'):
            module.prepare(self.template, self.registry, {'changes': [dict(repository='invented', kind='modify')]})


if __name__ == '__main__':
    unittest.main()
