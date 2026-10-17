import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('chart_release', ROOT / '.github/scripts/chart_release.py')
chart_release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(chart_release)


@unittest.skipUnless(shutil.which('helm'), 'Helm is required for packaging integration test')
class ChartReleaseTests(unittest.TestCase):
    def test_package_is_repeatable_and_pins_both_containers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'sdx/chart/sdx-edge', root / 'sdx/chart/sdx-edge')
            previous = Path.cwd()
            os.chdir(root)
            try:
                digest = 'sha256:' + 'a' * 64
                def identity(*args):
                    return digest if args[0] == 'docker' else 'a' * 40
                with patch.object(chart_release, 'run', side_effect=identity), patch.object(sys, 'argv', ['chart_release', '--version', '0.3.12', '--edge-version', '0.1.0']):
                    chart_release.main()
                    first = (root / 'release-assets/sdx-edge-0.3.12.tgz').read_bytes()
                    chart_release.main()
                self.assertEqual(first, (root / 'release-assets/sdx-edge-0.3.12.tgz').read_bytes())
                receipt = json.loads((root / 'release-assets/sdx-edge.json').read_text())
                self.assertEqual(receipt['image_digest'], digest)
                output = chart_release.run('helm', 'template', 'check', str(root / 'release-assets/sdx-edge-0.3.12.tgz'))
                self.assertEqual(output.count('sdx-access-point@' + digest), 2)
                self.assertIn('appVersion: "3.9-705bde87"', (root / 'sdx/chart/sdx-edge/Chart.yaml').read_text())
            finally:
                os.chdir(previous)

    def test_chart_only_release_retains_previous_image(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'sdx/chart/sdx-edge', root / 'sdx/chart/sdx-edge')
            (root / 'release-plan.json').write_text(json.dumps({'components': [{'name': 'sdx-edge', 'previous': 'sdx-edge/v0.3.12'}]}))
            previous = Path.cwd()
            os.chdir(root)
            original_command = chart_release.subprocess.run
            try:
                digest = 'sha256:' + 'b' * 64
                def identity(*args):
                    if args[0] == 'docker':
                        self.fail('Must retain receipt digest, not resolve a mutable image tag')
                    return 'a' * 40
                def command(args, **kwargs):
                    if args[0] == 'gh':
                        destination = Path(args[args.index('--dir') + 1])
                        (destination / 'sdx-edge.json').write_text(json.dumps({'revision': 'a' * 40, 'image': 'ghcr.io/bcgov/aps-devops/sdx-access-point:v0.1.0', 'image_digest': digest}))
                        return None
                    return original_command(args, **kwargs)
                with patch.object(chart_release, 'run', side_effect=identity), patch.object(chart_release.subprocess, 'run', side_effect=command), patch.object(sys, 'argv', ['chart_release', '--version', '0.3.13']):
                    chart_release.main()
                receipt = json.loads((root / 'release-assets/sdx-edge.json').read_text())
                self.assertEqual(receipt['image_digest'], digest)
                self.assertEqual(receipt['image'], 'ghcr.io/bcgov/aps-devops/sdx-access-point:v0.1.0')
            finally:
                os.chdir(previous)


if __name__ == '__main__':
    unittest.main()
