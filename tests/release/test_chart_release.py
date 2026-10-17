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

    def test_edge_publication_updates_files_then_packages_then_publishes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copytree(ROOT / 'sdx/chart/sdx-edge', root / 'sdx/chart/sdx-edge')
            previous = Path.cwd()
            os.chdir(root)
            digest = 'sha256:' + 'c' * 64
            image = 'ghcr.io/bcgov/aps-devops/sdx-access-point:sha-' + 'a' * 40 + '-' + 'b' * 64
            published = []
            try:
                def identity(*args):
                    if args[0] == 'git':
                        return 'a' * 40
                    self.fail('An explicit image receipt must avoid registry lookup during preparation')
                with patch.object(chart_release, 'run', side_effect=identity), patch.object(sys, 'argv', ['chart_release', '--stage', 'prepare', '--edge-image', image, '--image-digest', digest]):
                    chart_release.main()
                version = '0.3.11-dev.' + 'a' * 40 + '.' + 'c' * 64
                self.assertIn('version: ' + version, (root / '.release-chart/sdx-edge/Chart.yaml').read_text())
                self.assertIn('appVersion: "' + image.rsplit(':', 1)[1] + '"', (root / '.release-chart/sdx-edge/Chart.yaml').read_text())
                values = (root / '.release-chart/sdx-edge/values.yaml').read_text()
                self.assertIn('imageDigest: "' + digest + '"', values)
                self.assertIn('imageTag: "' + image.rsplit(':', 1)[1] + '"', values)
                self.assertFalse((root / 'release-assets').exists())
                for stage in ['validate', 'package']:
                    with patch.object(sys, 'argv', ['chart_release', '--stage', stage]):
                        chart_release.main()
                package = root / ('release-assets/sdx-edge-' + version + '.tgz')
                self.assertTrue(package.exists())
                rendered = chart_release.run('helm', 'template', 'check', str(package))
                self.assertEqual(rendered.count('sdx-access-point@' + digest), 2)
                for line in rendered.splitlines():
                    if 'app.kubernetes.io/version:' in line:
                        self.assertLessEqual(len(line.split(':', 1)[1].strip().strip('"')), 63)
                def publication(args, **kwargs):
                    if args[0] == 'docker':
                        return chart_release.subprocess.CompletedProcess(args, 1, '', 'manifest unknown')
                    published.append(args)
                    return chart_release.subprocess.CompletedProcess(args, 0)
                with patch.object(chart_release.subprocess, 'run', side_effect=publication), patch.object(chart_release, 'run', return_value='sha256:' + 'd' * 64), patch.object(sys, 'argv', ['chart_release', '--stage', 'publish']):
                    chart_release.main()
                self.assertEqual(published[0][:2], ['helm', 'push'])
                receipt = json.loads((root / 'release-assets/sdx-edge.json').read_text())
                self.assertEqual(receipt['digest'], 'sha256:' + 'd' * 64)
                package.write_bytes(package.read_bytes() + b'changed')
                with patch.object(chart_release.subprocess, 'run') as command, patch.object(sys, 'argv', ['chart_release', '--stage', 'publish']):
                    with self.assertRaisesRegex(ValueError, 'changed after validation'):
                        chart_release.main()
                    command.assert_not_called()
            finally:
                os.chdir(previous)


if __name__ == '__main__':
    unittest.main()
