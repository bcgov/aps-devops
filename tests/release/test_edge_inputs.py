import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('edge_inputs', ROOT / '.github/scripts/edge_inputs.py')
edge_inputs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(edge_inputs)


class PluginReferenceTests(unittest.TestCase):
    def test_full_commit_needs_no_tag_lookup(self):
        with patch.object(edge_inputs.subprocess, 'check_output') as lookup:
            self.assertEqual(edge_inputs.resolve('a' * 40), 'a' * 40)
            lookup.assert_not_called()

    def test_annotated_tag_resolves_to_commit_not_tag_object(self):
        ref = 'kong-oss-plugins/v1.5.1'
        tags = f"{'b' * 40}\trefs/tags/{ref}\n{'a' * 40}\trefs/tags/{ref}^{{}}\n"
        with patch.object(edge_inputs.subprocess, 'check_output', return_value=tags):
            self.assertEqual(edge_inputs.resolve(ref), 'a' * 40)

    def test_lightweight_tag_resolves(self):
        with patch.object(edge_inputs.subprocess, 'check_output', return_value=f"{'a' * 40}\trefs/tags/v1.5.1\n"):
            self.assertEqual(edge_inputs.resolve('v1.5.1'), 'a' * 40)

    def test_missing_tag_or_branch_name_rejected(self):
        with patch.object(edge_inputs.subprocess, 'check_output', return_value=''):
            with self.assertRaises(ValueError):
                edge_inputs.resolve('dev')
        for bad in ['bad\nref', '--upload-pack=evil', '../refs/heads/main']:
            with self.subTest(ref=bad), self.assertRaises((ValueError, edge_inputs.subprocess.CalledProcessError)):
                edge_inputs.resolve(bad)

    def test_moved_default_tag_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = Path.cwd()
            os.chdir(directory)
            try:
                Path('sdx/image').mkdir(parents=True)
                Path('sdx/image/plugins.json').write_text(json.dumps({'ref': 'v1.5.1', 'revision': 'a' * 40}))
                with patch.object(edge_inputs, 'resolve', return_value='b' * 40), patch('sys.argv', ['edge_inputs']):
                    with self.assertRaisesRegex(ValueError, 'tag moved'):
                        edge_inputs.main()
            finally:
                os.chdir(previous)
