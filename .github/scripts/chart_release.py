#!/usr/bin/env python3
"""Package a source chart copy with release metadata; never modify the checkout."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import tarfile


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', required=True)
    parser.add_argument('--edge-version', default='')
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'\d+\.\d+\.\d+', args.version):
        raise ValueError('Invalid chart version')
    source = Path('sdx/chart/sdx-edge')
    output = Path('release-assets')
    output.mkdir(exist_ok=True)
    metadata = (source / 'Chart.yaml').read_text()
    app_version = args.edge_version and 'v' + args.edge_version
    if not app_version:
        app_version = re.search(r'^appVersion:\s*["\']?([^\s"\']+)', metadata, re.M)[1]
    image = f'ghcr.io/bcgov/aps-devops/sdx-access-point:{app_version}'
    digest = ''
    # A chart-only release retains the last released chart's image instead of
    # reverting to a historical appVersion still present in the source tree.
    if not args.edge_version and Path('release-plan.json').exists():
        plan = json.loads(Path('release-plan.json').read_text())
        previous = next(c['previous'] for c in plan['components'] if c['name'] == 'sdx-edge')
        if previous:
            with tempfile.TemporaryDirectory() as directory:
                subprocess.run(['gh', 'release', 'download', previous, '--pattern', 'sdx-edge.json', '--dir', directory], check=True)
                prior = json.loads((Path(directory) / 'sdx-edge.json').read_text())
            if prior['revision'] != run('git', 'rev-parse', previous + '^{commit}'):
                raise ValueError('Previous chart receipt differs from its release commit')
            image, digest = prior['image'], prior['image_digest']
            app_version = image.rsplit(':', 1)[1]
    if not digest:
        digest = run('docker', 'buildx', 'imagetools', 'inspect', image, '--format', '{{.Manifest.Digest}}')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
        raise ValueError('Registry did not return an immutable image digest')
    with tempfile.TemporaryDirectory() as directory:
        chart = Path(directory) / 'sdx-edge'
        shutil.copytree(source, chart)
        # Release overlays are packaged assets, not undocumented source commits.
        (chart / 'Chart.yaml').write_text(re.sub(r'^appVersion:.*$', f'appVersion: "{app_version}"', metadata, flags=re.M))
        values = chart / 'values.yaml'
        text = values.read_text()
        text, count = re.subn(r'(?m)^  imageDigest:.*$', f'  imageDigest: "{digest}"', text)
        if count != 1:
            raise ValueError('Expected exactly one kong.imageDigest default')
        values.write_text(text)
        subprocess.run(['helm', 'lint', str(chart)], check=True)
        subprocess.run(['helm', 'template', 'release-check', str(chart)], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['helm', 'template', 'release-check', str(chart), '--set', 'use_openshift_resources=false'], check=True, stdout=subprocess.DEVNULL)
        subprocess.run(['helm', 'package', str(chart), '--version', args.version, '--destination', str(output)], check=True)
    package = output / f'sdx-edge-{args.version}.tgz'
    normalized = io.BytesIO()
    with tarfile.open(package, 'r:gz') as original:
        with tarfile.open(fileobj=normalized, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for member in sorted(original.getmembers(), key=lambda item: item.name):
                member.mtime = 0
                member.uid = member.gid = 0
                member.uname = member.gname = ''
                member.pax_headers = {}
                archive.addfile(member, original.extractfile(member) if member.isfile() else None)
    compressed = io.BytesIO()
    with gzip.GzipFile(fileobj=compressed, mode='wb', filename='', mtime=0) as stream:
        stream.write(normalized.getvalue())
    package.write_bytes(compressed.getvalue())
    receipt = {'component': 'sdx-edge', 'version': args.version, 'image': image, 'image_digest': digest,
               'revision': run('git', 'rev-parse', 'HEAD'), 'package_sha256': hashlib.sha256(package.read_bytes()).hexdigest()}
    if args.publish:
        reference = f'ghcr.io/bcgov/aps-devops/sdx-edge:{args.version}'
        existing = subprocess.run(['docker', 'buildx', 'imagetools', 'inspect', reference, '--raw'], text=True, capture_output=True)
        if existing.returncode == 0:
            # Refuse overwrites. Compare Helm content layer to the package checksum.
            manifest = json.loads(existing.stdout)
            layers = [x['digest'] for x in manifest['layers'] if x['mediaType'] == 'application/vnd.cncf.helm.chart.content.v1.tar+gzip']
            if layers != ['sha256:' + receipt['package_sha256']]:
                raise ValueError('Chart version already exists with different content; refusing overwrite')
        elif re.search(r'not found|manifest unknown', existing.stderr, re.I):
            subprocess.run(['helm', 'push', str(package), 'oci://ghcr.io/bcgov/aps-devops'], check=True)
        else:
            raise RuntimeError(existing.stderr)
        receipt['digest'] = run('docker', 'buildx', 'imagetools', 'inspect', reference, '--format', '{{.Manifest.Digest}}')
    (output / 'sdx-edge.json').write_text(json.dumps(receipt, indent=2) + '\n')


if __name__ == '__main__':
    main()
