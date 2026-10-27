# Which envs a change reaches

Promotion flow:

- Push to `dev` deploys **dev** on Gold, Gold DR, Silver and Emerald dev. Everything already on `dev` is live in dev.
- Merging the promotion PR (a `release/<name>` branch cut from `dev`, or `dev` itself) into `master` deploys **test** on all clusters (`master.yml` → `deploy/test/package-tag`). Emerald test deploys from `master`.
- **Prod** is manual: `deploy/prod/package-tag`, plus `emerald-prod.yml` for Emerald.

So a promotion PR's risk is about what changes in **test** now and in **prod** later.

## Terraform (Gold, Silver)

- `terraform/workspaces/gold/versions.tf` and `terraform/workspaces/silver/versions.tf`:
  - `dev_versions` covers dev and lab. Internal images often use the moving `"dev"` tag, so dev already runs the latest code.
  - `test_and_prod_versions` covers test and prod. This is what the PR promotes.
  - SDX tiers (`sdx_dev_versions`, `sdx_test_versions`, `sdx_prod_versions`) are in the same Gold file. Gold `dev` uses the SDX workspace `apsdev`, Gold `test` uses `apstst`, and Gold `prod` has **no** SDX module (`count = 0` in `app-sdx.tf`).
- Check `count` guards on **every** resource in the file. The first `count` may belong to a different resource (in `app-fluentd.tf`, for example, the ConfigMap has no guard but a route below it does). A dev-only deployment can have an unguarded route beside it, and that route then gets created in test and prod. PR 311's `keycloak26-oc-route` and `sdx-kong-cluster-oc-route` did this. Examples seen:
  - `app-bcgov-csit-backstage.tf` (DevHub): dev only.
  - `app-bcgov-csit-mickrocks.tf`: the helm release is dev and Gold only.
- Read each resource's `tag:` line, not just `versions.tf`. Older Portal, feeder and batch resources used `tag: ${var.workspace == "test" ? "test" : local.versions.bcgov-aps-portal}`, so test ran the moving `:test` image and a version bump only changed prod. Current `dev` no longer does this, but check.
- `lifecycle { ignore_changes = all }` (e.g. `app-postgresql-init-db.tf`) means script or value edits don't re-apply to existing envs.
- Ternaries on `var.workspace` and `local.dc` (`gold`/`golddr`) inside templates. Look for prod lists that don't exclude Gold DR.
- `terraform/modules/*` apply wherever the module is used. A module change in `modules/sdx` hits apstst **and** the SDX workspace tiers.

## SDX workspace (`terraform/workspaces/sdx`, namespaces `e55591-*`)

It has separate deploy workflows:

- `sdx-dev.yml`: push to `dev` → `sdxdev` (edge env `stg`).
- `sdx-master.yml`: runs automatically after "Draft release from master" → `sdxtst` (edge env `bct`).
- `sdx-prod.yml`: manual → `sdxprd` (edge env `bc`).

The env names come from `edge_env_map` in `terraform/modules/sdx/endpoints.tf`. Versions are in `terraform/workspaces/sdx/versions.tf`.

## Emerald (Helm)

`charts/emerald/<env>/values.yaml` plus the chart defaults in `charts/apsgw` and `charts/apsgw-dp`. Each env renders its own vendored chart copy, so a change to the shared defaults only reaches an env once that env's job runs.

## Gateway config that does deploy

`terraform/workspaces/gold/artifacts/gwa-platform/` is **live**. `app-kong-init.tf` packs the files in it (with a checksum that triggers a rerun) and pushes them to the APS gateway. Top-level `gwa-platform/*.yaml` files reach **every** env. Env-specific files sit under `gwa-platform/<env>/` (`fileset(…/gwa-platform/${var.workspace}, "*.yaml")`), so a file under `test/` or `prod/` only reaches that env. Treat changes there like any other gateway config: rate limits, auth plugins, hosts and request termination. A new file under `test/` or `prod/` is a new public route.

## Files that don't deploy

- `.sdx/**`: master org and subsystem config that an operator applies by hand, not the pipeline.
- `dns/**`: inventory snapshots.
- Other `artifacts/**` folders (e.g. `artifacts/sdx/`, `workspaces/sdx/artifacts/`): reference manifests and READMEs, unless a `.tf` file reads them with `file()`, `templatefile()` or `fileset()`. Grep the workspace for the folder name before assuming.
- `dockerfiles/**`: source only. An image built from it only deploys once a tag built from it is referenced in `versions.tf` or a chart.
- `archive/**`, docs and CHANGELOGs.

Moving a `.tf` file into `archive/` **removes** its resources from Terraform, so check where those resources existed.
