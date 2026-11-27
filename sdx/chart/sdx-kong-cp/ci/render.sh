#!/usr/bin/env bash
# Run from the repository root after helm dependency build.
set -euo pipefail
chart=sdx/chart/sdx-kong-cp
edge=sdx/chart/sdx-edge
temp=$(mktemp -d)
trap 'rm -rf "$temp"' EXIT
version=$(sed -nE 's/^ARG KONG_VERSION="?([0-9]+\.[0-9]+\.[0-9]+)"?$/\1/p' sdx/image/Dockerfile)
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
published_image=$(yq -r .kong.image.unifiedRepoTag "$chart/values.yaml")
image=$published_image
if [[ -n "$published_image" ]]; then
  test "$(yq -r .kong.image.effectiveSemver "$chart/values.yaml")" = "$version"
  test "${image##*@}" = "$(yq -r .kong.imageDigest "$edge/values.yaml")"
  [[ "$image" =~ @sha256:[0-9a-f]{64}$ ]]
  helm template check "$edge" > "$temp/edge.yaml"
  test "$(grep -Fc "${image%:*@*}@${image##*@}" "$temp/edge.yaml")" = 2
else
  image=ghcr.io/bcgov/aps-devops/sdx-access-point:v1.0.1@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
fi
export image version
yq '.image.unifiedRepoTag = strenv(image) | .image.effectiveSemver = strenv(version)' "$chart/ci/control-plane.yaml" > "$temp/upstream.yaml"
if [[ -n "$published_image" ]]; then
  yq '{"kong": .}' "$chart/ci/control-plane.yaml" > "$temp/wrapper.yaml"
else
  yq '{"kong": .}' "$temp/upstream.yaml" > "$temp/wrapper.yaml"
fi
for mode in install upgrade; do
  upgrade=false
  if [[ "$mode" == upgrade ]]; then upgrade=true; fi
  helm template sdx-konghc "$chart/charts/kong-2.47.0.tgz" -f "$temp/upstream.yaml" --is-upgrade="$upgrade" > "$temp/upstream-render.yaml"
  helm template sdx-konghc "$chart" -f "$temp/wrapper.yaml" --is-upgrade="$upgrade" > "$temp/wrapper-render.yaml"
  # Ignore Helm source comments. All deployed objects and hooks must match.
  diff -u <(sed '/^# Source:/d' "$temp/upstream-render.yaml") <(sed '/^# Source:/d' "$temp/wrapper-render.yaml")
  grep -Fq "image: $image" "$temp/wrapper-render.yaml"
  grep -Fq 'name: sdx-konghc-kong-cluster' "$temp/wrapper-render.yaml"
  grep -Fq 'path: /status/ready' "$temp/wrapper-render.yaml"
done
