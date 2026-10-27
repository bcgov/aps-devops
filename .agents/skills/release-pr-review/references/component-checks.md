# Upstream checks per component

General compare recipe (works for any public repo with release tags):

```bash
gh api repos/<owner>/<repo>/compare/<old>...<new> --jq '.commits[] | [.sha[0:8], (.commit.message|split("\n")[0])] | @tsv' | grep -v "Merge pull"
gh api repos/<owner>/<repo>/compare/<old>...<new> --jq '.files[] | [.filename, .changes] | @tsv'
gh api repos/<owner>/<repo>/compare/<old>...<new> --jq '.files[] | select(.filename=="<path>") | .patch'
```

Read a file at a tag with `gh api "repos/<o>/<r>/contents/<path>?ref=<tag>" --jq .content | base64 -d`. Don't rely on GitHub code search for "is this in the release". It only indexes the default branch, which is `dev` for several of these repos. A blobless clone plus `git grep <tag>` also works, but it is slow because blobs are fetched on demand.

Check that an image tag exists without registry auth:

```bash
tok=$(curl -s "https://ghcr.io/token?scope=repository:bcgov/<image>:pull" | jq -r .token)
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $tok" \
  -H 'Accept: application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.v2+json' \
  "https://ghcr.io/v2/bcgov/<image>/manifests/<tag>"   # 200 = exists
```

## switchover-agent: `bcgov/switchover-agent` (`bcgov-switchover` in versions.tf)

This is DR failover logic, so treat any source change as **HIGH (latent)**. It only runs during an outage, so a regression shows up at the worst time.

Look for changes to Tekton trigger signing (`src/clients/tekton.py`), maintenance-mode transitions (`src/transitions/`) and Patroni role changes. Validate with: agent healthy on Gold and Gold DR, the `switchover_maintenance` gauge reads 0, and a controlled switchover or chaos run produces the expected PipelineRun.

## gwa-api: `bcgov/gwa-api`

One tag covers several images. Map each to its source directory and check which ones actually changed:

| versions.tf key | image | source dir |
|---|---|---|
| `bcgov-gwa-gateway-api` (also the SDX `gwa-api`) | `gwa-api/gwa-gateway-api` | `microservices/gatewayApi` |
| `bcgov-gwa-scheduler` | `gwa-api/gwa-scheduler` | `microservices/gatewayJobScheduler` |
| `bcgov-gwa-kube-api` (Gold and Silver) | `gwa-api/gwa-kube-api` | `microservices/kubeApi` |
| `bcgov-gwa-compatibility-api` | `gwa-api/gwa-compatibility-api` | `microservices/compatibilityApi` |
| `bcgov-gwa-csit-oas-validation-api` | `gwa-api/gwa-csit-oas-validation-api` | `microservices/csitOasValidationApi` |
| `bcgov-sdx-ca-token-api` | `gwa-api/gwa-sdx-ca-token-api` | `microservices/sdxStepTokenApi` |

- An image whose directory didn't change between the tags is a rebuild: LOW.
- Diff from the **oldest** tag the env is coming from. Components can sit on different old tags (e.g. compatibility-api on v1.0.50 while the others were on v1.0.51).
- The scheduler drives OpenShift route sync for every API. A change to its Kong client, Dockerfile, base image or dependencies is **HIGH**. Also check that removed tools (kubectl, curl, jq) aren't still called from its Python code.
- gateway-api backs `gwa` CLI publishing. Additive endpoints are MEDIUM. Changes to deck binaries or validators deserve a publish test.
- ca-token-api moving from the `:dev` tag to a release tag can't be diffed (`:dev` moves). Say so in Gaps.

## api-services-portal: `bcgov/api-services-portal`

- `bcgov-aps-portal` sets the Portal **and** feeder (`data-feeder` image) tags. `bcgov-provisioner-api` sets `provisioner-svc`.
- The default branch is `dev`, which is often far ahead of the release. Check `compare/<release>...dev --jq .ahead_by`.
- For every new Portal, feeder or provisioner env var, read it at the release tag. Known pattern: the infra adds config for features merged to Portal `dev` but not released. That's inert (LOW) unless the old code misreads it.
- Feeder `KONG_ADMIN_URL`: v3.0.14 and older split commas only in `forceSync` and pass the whole string to full `sync`. Multi-Kong support without cross-deletes is bcgov/api-services-portal#1575 (APS-5013). Don't send a list to a feeder release that lacks it.

## sdx-edge chart: `bcgov/aps-devops`, `sdx/chart/sdx-edge`

Published as `oci://ghcr.io/bcgov/aps-devops/sdx-edge`. Releases aren't tagged consistently, so use the commit history of the chart path and read `Chart.yaml` at a commit to find the version:

```bash
gh api 'repos/bcgov/aps-devops/commits?path=sdx/chart/sdx-edge&per_page=60' --jq '.[] | [.sha[0:8], .commit.author.date[0:10], (.commit.message|split("\n")[0])] | @tsv'
```

The templates do `index .Values.<x>_url_by_env .Values.environment` for the control-plane, CA, logs aggregator and metrics remote-write URLs. Grep `values.yaml` at the pinned version and confirm the env from `edge_env_map` is a key. The stg/bct/bc keys were added 2026-09-24 (after 0.3.10), so 0.3.6 doesn't have them.

## dp-query-api: in this repo, `dockerfiles/dp-query-api`

It's a sidecar (`kong-dp-cache-query`) in **every** Kong DP pod: Gold, Gold DR, Silver and Emerald. It mounts Kong's prefix dir and LMDB, feeds the metricsproxy enrichment (Portal API metrics), and serves the admin cache the scheduler reads for route sync. Treat a rewrite or change of runtime as **HIGH**. The sidecar has a liveness probe only, so a failure restarts the sidecar rather than taking the pod out of rotation.

## Fluentd: `terraform/workspaces/gold/app-fluentd.tf`

The Prometheus labels feed the Portal metrics. Changes to labels or record fields are MEDIUM and indirectly Portal-facing. Any field added to the record also lands in the S3 log output.
