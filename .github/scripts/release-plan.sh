#!/usr/bin/env bash
# Select changed components and increment each component's own stable Git tag.
set -euo pipefail
jq -e '.pull_request | .base.ref == "main" and .head.ref == "dev" and
  .head.repo.full_name == .base.repo.full_name' "$GITHUB_EVENT_PATH" >/dev/null
bump=$(jq -er '[.pull_request.labels[].name | select(startswith("release="))] |
  if length == 1 then .[0] | capture("^release=(?<bump>major|minor|patch)$").bump else error("Choose one release=major/minor/patch label") end' "$GITHUB_EVENT_PATH")
sha=$(git rev-parse HEAD)
if jq -e '.pull_request.merged == true' "$GITHUB_EVENT_PATH" >/dev/null; then
  test "$sha" = "$(jq -r '.pull_request.merge_commit_sha' "$GITHUB_EVENT_PATH")"
  test "$(git rev-list --parents -n 1 HEAD | awk '{print NF}')" = 3
  test "$(git rev-parse HEAD^2)" = "$(jq -r '.pull_request.head.sha' "$GITHUB_EVENT_PATH")"
  base=$(git rev-parse HEAD^1)
  release_base=$sha
else
  test "$sha" = "$(jq -r '.pull_request.head.sha' "$GITHUB_EVENT_PATH")"
  release_base=$(jq -r .pull_request.base.sha "$GITHUB_EVENT_PATH")
  base=$(git merge-base "$release_base" HEAD)
fi
selected=$(mktemp)
trap 'rm -f "$selected"' EXIT
shared=()
while IFS= read -r path; do shared+=("$path"); done < <(jq -r '.shared_paths[]' .github/release/components.json)
# Resolve the edge dependency before iterating; manifest order is irrelevant.
edge_paths=()
while IFS= read -r path; do edge_paths+=("$path"); done < <(jq -r '.components[] | select(.name=="sdx-access-point") | .paths[]' .github/release/components.json)
edge_changed=false
if [[ ${#edge_paths[@]} -gt 0 ]] && ! git diff --quiet "$base" "$sha" -- "${edge_paths[@]}" "${shared[@]}"; then edge_changed=true; fi
while IFS= read -r component; do
  name=$(jq -r .name <<< "$component")
  paths=()
  while IFS= read -r path; do paths+=("$path"); done < <(jq -r '.paths[]' <<< "$component")
  if git diff --quiet "$base" "$sha" -- "${paths[@]}" "${shared[@]}"; then
    if [[ "$name" != sdx-edge || "$edge_changed" != true ]]; then continue; fi
  fi
  previous=$(git tag --list "$name/v*" --sort=-version:refname | grep -E '/v[0-9]+\.[0-9]+\.[0-9]+$' | sed -n '1p' || true)
  existing=$(git tag --points-at "$sha" --list "$name/v*" | grep -E '/v[0-9]+\.[0-9]+\.[0-9]+$' || true)
  if [[ -n "$existing" ]]; then
    test "$(printf '%s\n' "$existing" | wc -l | tr -d ' ')" = 1
    version=${existing##*/v}
    previous=$(git tag --list "$name/v*" --sort=-version:refname | grep -E '/v[0-9]+\.[0-9]+\.[0-9]+$' | grep -Fxv "$existing" | sed -n '1p' || true)
  else
    current=${previous##*/v}
    if [[ -z "$current" ]]; then current=$(jq -r .baseline <<< "$component"); fi
    if [[ -n "$previous" ]]; then git merge-base --is-ancestor "$previous" "$release_base"; fi
    version=$(semver "$current" --increment "$bump")
  fi
  jq -cn --argjson component "$component" --arg version "$version" --arg previous "$previous" \
    '$component + {version:$version,tag:( $component.name + "/v" + $version),previous:$previous}' >> "$selected"
done < <(jq -c '.components[]' .github/release/components.json)
jq -s '.' "$selected" > release-plan.json
# Stable chart metadata must be committed and reviewed before promotion.
chart_context=$(jq -r '.[] | select(.kind=="chart") | .context' release-plan.json)
if [[ -n "$chart_context" ]]; then
  chart_version=$(jq -r '.[] | select(.kind=="chart") | .version' release-plan.json)
  actual=$(yq -r '.version' "$chart_context/Chart.yaml")
  [[ "$actual" == "$chart_version" ]] || { echo "Chart.yaml version must be $chart_version (found $actual)." >&2; exit 1; }
  edge_version=$(jq -r '.[] | select(.name=="sdx-access-point") | .version' release-plan.json)
  if [[ -n "$edge_version" ]]; then
    actual=$(yq -r '.appVersion' "$chart_context/Chart.yaml")
    [[ "$actual" == "v$edge_version" ]] || { echo "Chart.yaml appVersion must be v$edge_version (found $actual)." >&2; exit 1; }
  fi
fi
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    echo "images=$(jq -c '{include:[.[]|select(.kind=="image" and .name!="sdx-access-point")|.file //= (.context+"/Dockerfile")]}' release-plan.json)"
    echo "has_images=$(jq 'any(.[];.kind=="image" and .name!="sdx-access-point")' release-plan.json)"
    echo "has_edge=$(jq 'any(.[];.name=="sdx-access-point")' release-plan.json)"
    echo "has_chart=$(jq 'any(.[];.kind=="chart")' release-plan.json)"
    echo "has_components=$(jq 'length>0' release-plan.json)"
    echo "edge_version=$(jq -r '.[]|select(.name=="sdx-access-point")|.version' release-plan.json)"
    echo "chart_version=$(jq -r '.[]|select(.kind=="chart")|.version' release-plan.json)"
  } >> "$GITHUB_OUTPUT"
fi
jq -r '.[]|.tag' release-plan.json
