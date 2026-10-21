#!/usr/bin/env bash
# Exercise the real helper against temporary Git history; no remote writes.
set -euo pipefail
helper="$(cd "$(dirname "$0")/.." && pwd)/.github/scripts/release-plan.sh"
fixture=$(mktemp -d)
trap 'rm -rf "$fixture"' EXIT
cd "$fixture"
git init -q -b main
git config user.email release-test@example.invalid
git config user.name 'Release test'
mkdir -p .github/release source other chart
cat > .github/release/components.json <<'JSON'
{"components":[
 {"name":"sdx-access-point","kind":"image","paths":["source/"],"context":".","baseline":"0.0.0"},
 {"name":"other","kind":"image","paths":["other/"],"context":"other","baseline":"1.9.0"},
 {"name":"sdx-edge","kind":"chart","paths":["chart/"],"context":"chart","baseline":"0.3.11"}
],"shared_paths":[".github/workflows/"]}
JSON
printf 'version: 0.3.11\nappVersion: "v0.10.0"\n' > chart/Chart.yaml
echo base > source/file
echo base > other/file
git add .
git commit -qm base
base=$(git rev-parse HEAD)
git tag sdx-access-point/v0.9.0
git tag sdx-access-point/v0.10.0
git tag other/v99.0.0
git checkout -qb dev
echo change > source/file
git commit -qam change
head=$(git rev-parse HEAD)
export GITHUB_EVENT_PATH="$fixture/event.json" GITHUB_OUTPUT="$fixture/outputs"
event() {
  case "$1" in
    *release=patch*) printf 'version: 0.3.12\nappVersion: "v0.10.1"\n' > chart/Chart.yaml ;;
    *release=minor*) printf 'version: 0.4.0\nappVersion: "v0.11.0"\n' > chart/Chart.yaml ;;
    *release=major*) printf 'version: 1.0.0\nappVersion: "v1.0.0"\n' > chart/Chart.yaml ;;
  esac
  jq -n --arg base "$base" --arg head "$head" --argjson labels "$1" \
    '{pull_request:{base:{ref:"main",sha:$base,repo:{full_name:"test/repo"}},head:{ref:"dev",sha:$head,repo:{full_name:"test/repo"}},labels:$labels,merged:false}}' > "$GITHUB_EVENT_PATH"
}
event '[{"name":"release=patch"}]'
bash "$helper"
jq -e 'length==2 and .[0].tag=="sdx-access-point/v0.10.1" and .[1].tag=="sdx-edge/v0.3.12"' release-plan.json >/dev/null
grep -q 'has_edge=true' "$GITHUB_OUTPUT"
grep -q 'has_images=false' "$GITHUB_OUTPUT"
# Reject independently wrong chart and application versions.
cp chart/Chart.yaml valid-chart.yaml
sed 's/0.3.12/0.3.99/' valid-chart.yaml > chart/Chart.yaml
if bash "$helper" >/dev/null 2>&1; then echo 'Accepted wrong chart version' >&2; exit 1; fi
sed 's/v0.10.1/v0.10.99/' valid-chart.yaml > chart/Chart.yaml
if bash "$helper" >/dev/null 2>&1; then echo 'Accepted wrong chart appVersion' >&2; exit 1; fi
mv valid-chart.yaml chart/Chart.yaml
# A chart placed before its image must still be selected for an image-only change.
cp .github/release/components.json original-components.json
jq '.components |= reverse' original-components.json > .github/release/components.json
: > "$GITHUB_OUTPUT"
bash "$helper"
jq -e 'length==2 and (map(.tag)|sort)==["sdx-access-point/v0.10.1","sdx-edge/v0.3.12"]' release-plan.json >/dev/null
grep -q 'has_chart=true' "$GITHUB_OUTPUT"
mv original-components.json .github/release/components.json
# No changed paths means no release; a fork cannot supply a promotion.
jq --arg head "$head" '.pull_request.base.sha=$head' "$GITHUB_EVENT_PATH" > empty.json
mv empty.json "$GITHUB_EVENT_PATH"
bash "$helper"
jq -e 'length==0' release-plan.json >/dev/null
event '[{"name":"release=patch"}]'
jq '.pull_request.head.repo.full_name="fork/repo"' "$GITHUB_EVENT_PATH" > fork.json
mv fork.json "$GITHUB_EVENT_PATH"
if bash "$helper" >/dev/null 2>&1; then echo 'Accepted fork promotion' >&2; exit 1; fi
event '[{"name":"release=minor"}]'
bash "$helper"
jq -e '.[0].version=="0.11.0" and .[1].version=="0.4.0"' release-plan.json >/dev/null
event '[{"name":"release=major"}]'
bash "$helper"
jq -e '.[0].version=="1.0.0" and .[1].version=="1.0.0"' release-plan.json >/dev/null
for labels in '[]' '[{"name":"release=patch"},{"name":"release=minor"}]' '[{"name":"release=invalid"}]'; do
  event "$labels"
  if bash "$helper" >/dev/null 2>&1; then echo "Accepted invalid labels: $labels" >&2; exit 1; fi
done
event '[{"name":"release=patch"}]'
git checkout -- chart/Chart.yaml
git checkout -q main
git merge -q --no-ff dev -m promotion
sha=$(git rev-parse HEAD)
jq --arg sha "$sha" '.pull_request.merged=true | .pull_request.merge_commit_sha=$sha' "$GITHUB_EVENT_PATH" > merged.json
mv merged.json "$GITHUB_EVENT_PATH"
printf 'version: 0.3.12\nappVersion: "v0.10.1"\n' > chart/Chart.yaml
bash "$helper"
git tag sdx-access-point/v0.10.1
git tag sdx-edge/v0.3.12
bash "$helper"
jq -e '.[0].version=="0.10.1" and .[1].version=="0.3.12"' release-plan.json >/dev/null
# A squash/rebase result must not silently substitute for a promotion merge.
git checkout -- chart/Chart.yaml
git checkout -q dev
jq --arg sha "$head" '.pull_request.merge_commit_sha=$sha' "$GITHUB_EVENT_PATH" > wrong.json
mv wrong.json "$GITHUB_EVENT_PATH"
if bash "$helper" >/dev/null 2>&1; then echo 'Accepted promotion without merge ancestry' >&2; exit 1; fi
# Preview the next promotion without merging main back into dev.
echo next > source/file
printf 'version: 0.3.13\nappVersion: "v0.10.2"\n' > chart/Chart.yaml
git add source/file chart/Chart.yaml
git commit -qm next
head=$(git rev-parse HEAD)
base=$sha
event '[{"name":"release=patch"}]'
printf 'version: 0.3.13\nappVersion: "v0.10.2"\n' > chart/Chart.yaml
bash "$helper"
jq -e '.[0].version=="0.10.2" and .[1].version=="0.3.13"' release-plan.json >/dev/null
# Chart-only promotion retains the committed application version.
jq '.components[] |= (if .name=="sdx-access-point" then .paths=["unchanged/"] else . end)' .github/release/components.json > next-components.json
mv next-components.json .github/release/components.json
bash "$helper"
jq -e 'length==1 and .[0].name=="sdx-edge"' release-plan.json >/dev/null
echo 'Release selection, chart metadata, dependency, version, label and retry checks passed.'
