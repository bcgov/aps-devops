#!/usr/bin/env python3
"""Update chart metadata/values, validate, package, then publish immutable assets."""
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

SOURCE = Path('sdx/chart/sdx-edge')
STAGED = Path('.release-chart/sdx-edge')
OUTPUT = Path('release-assets')


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def prepare(args):
    metadata = (SOURCE / 'Chart.yaml').read_text()
    app_version = args.edge_version and 'v' + args.edge_version
    if not app_version:
        app_version = re.search(r'^appVersion:\s*["\']?([^\s"\']+)', metadata, re.M)[1]
    image = args.edge_image or f'ghcr.io/bcgov/aps-devops/sdx-access-point:{app_version}'
    digest = args.image_digest
    if not args.edge_image and not args.edge_version and Path('release-plan.json').exists():
        plan = json.loads(Path('release-plan.json').read_text())
        previous = next(c['previous'] for c in plan['components'] if c['name'] == 'sdx-edge')
        if previous:
            with tempfile.TemporaryDirectory() as directory:
                subprocess.run(['gh', 'release', 'download', previous, '--pattern', 'sdx-edge.json', '--dir', directory], check=True)
                prior = json.loads((Path(directory) / 'sdx-edge.json').read_text())
            if prior['revision'] != run('git', 'rev-parse', previous + '^{commit}'):
                raise ValueError('Previous chart receipt differs from its release commit')
            image, digest = prior['image'], prior['image_digest']
    if not re.fullmatch(r'ghcr\.io/bcgov/aps-devops/sdx-access-point:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}', image):
        raise ValueError('Invalid edge image reference')
    app_version = image.rsplit(':', 1)[1]
    if not digest:
        digest = run('docker', 'buildx', 'imagetools', 'inspect', image, '--format', '{{.Manifest.Digest}}')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}', digest):
        raise ValueError('Registry did not return an immutable image digest')
    revision = run('git', 'rev-parse', 'HEAD')
    version = args.version
    if not version and args.edge_image:
        base = re.search(r'^version:\s*(\d+\.\d+\.\d+)\s*$', metadata, re.M)[1]
        version = f'{base}-dev.{revision}.{digest[7:]}'
    if not re.fullmatch(r'\d+\.\d+\.\d+(?:-dev\.[0-9a-f]{40}\.[0-9a-f]{64})?', version):
        raise ValueError('Invalid chart version')
    if STAGED.exists():
        shutil.rmtree(STAGED)
    shutil.copytree(SOURCE, STAGED)
    metadata = re.sub(r'^version:.*$', f'version: {version}', metadata, flags=re.M)
    metadata = re.sub(r'^appVersion:.*$', f'appVersion: "{app_version}"', metadata, flags=re.M)
    (STAGED / 'Chart.yaml').write_text(metadata)
    text = (STAGED / 'values.yaml').read_text()
    for key, value in [('imageTag', app_version), ('imageDigest', digest)]:
        text, count = re.subn(rf'(?m)^  {key}:.*$', f'  {key}: "{value}"', text)
        if count != 1:
            raise ValueError(f'Expected exactly one kong.{key} default')
    (STAGED / 'values.yaml').write_text(text)
    identity = {'component': 'sdx-edge', 'version': version, 'image': image,
                'image_digest': digest, 'revision': revision}
    Path('.release-chart/identity.json').write_text(json.dumps(identity, indent=2) + '\n')


def validate():
    subprocess.run(['helm', 'lint', str(STAGED)], check=True)
    for extra in [[], ['--set', 'use_openshift_resources=false']]:
        subprocess.run(['helm', 'template', 'release-check', str(STAGED), *extra], check=True, stdout=subprocess.DEVNULL)


def package():
    identity = json.loads(Path('.release-chart/identity.json').read_text())
    OUTPUT.mkdir(exist_ok=True)
    subprocess.run(['helm', 'package', str(STAGED), '--destination', str(OUTPUT)], check=True)
    archive_path = OUTPUT / f"sdx-edge-{identity['version']}.tgz"
    normalized = io.BytesIO()
    with tarfile.open(archive_path, 'r:gz') as original:
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
    archive_path.write_bytes(compressed.getvalue())
    identity['package_sha256'] = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    (OUTPUT / 'sdx-edge.json').write_text(json.dumps(identity, indent=2) + '\n')
    # Make the exact automatically updated files reviewable beside the package.
    for name in ['Chart.yaml', 'values.yaml']:
        shutil.copyfile(STAGED / name, OUTPUT / ('sdx-edge-' + name))


def publish():
    receipt = json.loads((OUTPUT / 'sdx-edge.json').read_text())
    archive = OUTPUT / f"sdx-edge-{receipt['version']}.tgz"
    if hashlib.sha256(archive.read_bytes()).hexdigest() != receipt['package_sha256']:
        raise ValueError('Chart package changed after validation/packaging')
    reference = f"ghcr.io/bcgov/aps-devops/sdx-edge:{receipt['version']}"
    existing = subprocess.run(['docker', 'buildx', 'imagetools', 'inspect', reference, '--raw'], text=True, capture_output=True)
    if existing.returncode == 0:
        manifest = json.loads(existing.stdout)
        layers = [x['digest'] for x in manifest['layers'] if x['mediaType'] == 'application/vnd.cncf.helm.chart.content.v1.tar+gzip']
        if layers != ['sha256:' + receipt['package_sha256']]:
            raise ValueError('Chart version already exists with different content; refusing overwrite')
    elif re.search(r'not found|manifest unknown', existing.stderr, re.I):
        subprocess.run(['helm', 'push', str(archive), 'oci://ghcr.io/bcgov/aps-devops'], check=True)
    else:
        raise RuntimeError(existing.stderr)
    receipt['digest'] = run('docker', 'buildx', 'imagetools', 'inspect', reference, '--format', '{{.Manifest.Digest}}')
    (OUTPUT / 'sdx-edge.json').write_text(json.dumps(receipt, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=['all', 'prepare', 'validate', 'package', 'publish'], default='all')
    parser.add_argument('--version', default='')
    parser.add_argument('--edge-version', default='')
    parser.add_argument('--edge-image', default='')
    parser.add_argument('--image-digest', default='')
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    if args.stage in ('all', 'prepare'):
        prepare(args)
    if args.stage in ('all', 'validate'):
        validate()
    if args.stage in ('all', 'package'):
        package()
    if args.stage == 'publish' or (args.stage == 'all' and args.publish):
        publish()


if __name__ == '__main__':
    main()
