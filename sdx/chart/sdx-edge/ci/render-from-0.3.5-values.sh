#!/usr/bin/env bash
# Render current templates with 0.3.5-shaped values (no renewal/rotation maps,
# no bootstrap.stageSecret / bootstrap.deferRestart). That matches Helm 3
# --reuse-values on a release upgraded from chart 0.3.5, where new chart
# defaults are not merged in.
set -euo pipefail

CHART_DIR=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cp -R "$CHART_DIR" "$TMP/sdx-edge"
rm -rf "$TMP/sdx-edge/ci"

python3 - "$TMP/sdx-edge/values.yaml" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
out = []
skip_map = False
for line in path.read_text().splitlines(True):
    if skip_map:
        if line.strip() == "" or line.startswith(" ") or line.startswith("\t") or line.lstrip().startswith("#"):
            continue
        skip_map = False
    if line.startswith("renewal:") or line.startswith("rotation:"):
        skip_map = True
        continue
    stripped = line.lstrip()
    indent = len(line) - len(stripped)
    if indent == 2 and (
        stripped.startswith("stageSecret:") or stripped.startswith("deferRestart:")
    ):
        continue
    out.append(line)
path.write_text("".join(out))
text = path.read_text()
for key in ("renewal:", "rotation:", "stageSecret:", "deferRestart:"):
    if key in text:
        raise SystemExit(f"failed to omit {key} from old-values fixture")
PY

helm template old-upgrade "$TMP/sdx-edge" >/dev/null
echo "ok: templates render with 0.3.5-shaped values (renewal/rotation omitted)"
