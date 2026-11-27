# SDX builds and releases

The workflows build artifacts and create releases. Deployments remain separate.

## Components

`.github/release/components.json` lists each component's paths, Docker context and starting version. Components use independent `<component>/vX.Y.Z` Git tags. Images use `ghcr.io/bcgov/aps-devops/<component>:vX.Y.Z`; Helm uses OCI chart versions without `v`.

The only release helper is `.github/scripts/release-plan.sh`. It validates one `release=major`, `release=minor` or `release=patch` label, selects changed components using `git diff`, and increments their own latest stable tags with the standard `semver` CLI. Shared workflow changes select all components. An edge-image change also selects the chart. Dependency selection is independent of component order in the manifest.

Initial baselines are defined in the component manifest. Historical repository-wide tags are preserved.

## Branches and images

- Feature/dev pushes build through `.build.yml`; PR builds do not publish.
- Same-repository feature PRs into dev request `gh pr merge --auto --squash`; GitHub applies required checks/reviews. Drafts and forks are excluded. If `AUTOMERGE_TOKEN` is not configured, the request is skipped.
- Dev -> main uses a reviewed PR and a merge commit. `Release policy / plan` validates labels and previews component versions. A single increment applies independently to all changed components.
- After merge, the workflow reserves component Git tags at that exact commit, builds/publishes images and charts, then uses `gh release create` with path-filtered `git log` notes. GitHub supplies source archives. Releases are not marked repository-wide latest.

Development images use `sha-<source-commit>` tags. Edge images append `-plugins-<plugins-commit>`, so changing the plugin dependency produces a different image even at the same source commit. Mutable branch aliases remain available for development. Existing image tags must match the source/plugin commits before they can be reused; stable tags are not overwritten.

## Plugins input

`sdx/image/plugins.json` holds the default plugins ref and expected commit. A ref can be a released tag or a full commit; branch names are rejected. The build uses `git ls-remote` to resolve lightweight/annotated tags and checks the default lock before passing:

```text
KONG_PLUGINS_REF=<tag-or-commit>
KONG_PLUGINS_REVISION=<resolved-commit>
```

Manual edge runs expose `plugins_ref`. Direct Docker builds can use `--build-arg KONG_PLUGINS_REF=vX.Y.Z`. The Dockerfile verifies an expected revision when supplied, labels the selection and records the actual commit at `/usr/local/share/sdx/plugins-revision`.

Update the default dependency through a reviewed PR after a plugins bundle release. The current default is the audited feature/mtls commit, not a newly published release. Other Git dependencies are pinned too; OS/package downloads are not fully hermetic. The image uses `pep`/`plugin-log`, matching the portal SDX image and infrastructure control plane; review remaining `openid-authzen` consumers before upgrading.

## SDX access-point image and charts

Both stable releases and feature/dev/images/manual publications use `.edge.yml`: publish the image, then publish both `sdx-edge` and `sdx-kong-cp` with the same chart version. The chart job receives the exact image tag and digest. `.chart.yml` uses normal commands:

1. Stable promotions require each committed Chart.yaml `version` to equal the planned chart version and `appVersion` to match the paired chart and equal the new image tag (including `v`) when the access-point image changes. The release policy checks these before merge; publication checks again. Use the release preview to update these fields in the promotion PR. Development builds update version/appVersion only in their temporary package. Both modes add the source annotation and image tag/digest. The control-plane chart also sets `kong.image.effectiveSemver` from the Dockerfile’s `KONG_VERSION`.
2. `helm lint` and `helm template` validate OpenShift/Kubernetes variants.
3. `helm package` creates the archive; `helm push` publishes it to GHCR OCI.

Branch/manual charts use `<source-chart-version>-dev.<GitHub-run-id>`; stable promotions use the incremented edge chart version for both charts. PR builds skip publication. A chart-only release uses the committed appVersion image tag.

The edge Kong containers and the control-plane Kong workloads use the same image digest. Updated YAML and the package are workflow artifacts and stable release assets; generated changes are not committed back to trigger another build. On retry, an existing chart version must match the source annotation and packaged values; `helm pull` retrieves that existing package instead of overwriting it. There is no custom archive normalization or receipt format.

The GHCR `aps-devops/sdx-edge` and `aps-devops/sdx-kong-cp` packages must grant `bcgov/aps-devops` **Write** under **Manage Actions access**. Repository `packages: write` alone does not grant access to an existing package. If Helm login succeeds but push fails with `permission_denied: write_package`, check this package setting before retrying the failed job.

## Failure, retry and rollout

For plugin schema changes, advance managed edges before the control plane in each Terraform tier. Verify the edges are healthy and connected before advancing the separate control-plane chart pin. Keep the `sdx-konghc` Helm release identity during cutover and nest its environment values under `kong`. Run a server-side dry run and verify the DEV upgrade, migration jobs, CP readiness and existing edge connections before promoting to other tiers.

Keep the image digests referenced by released charts in GHCR, including during package cleanup.

Promote one dev -> main PR at a time and wait for its release workflow. A failed build can leave a reserved Git tag without a release; rerunning the same promotion retains its version. Existing released versions are skipped. Colliding image/chart identities fail. GitHub concurrency is one active/one pending, not a durable queue.

`gh release create` handles release asset upload. If an interrupted upload leaves a draft, inspect it and use standard `gh release upload`/`gh release edit --draft=false` commands to finish before retrying. There is no custom recovery service. Do not merge another promotion over a failed release without a recovery decision.

dev/main require reviews and passing build checks. Squash merges go into dev and merge commits into main. Auto-merge uses an App/bot token without bypass rights, so merged feature PRs trigger dev builds.

Build workflows use source-path filters, including their caller and reusable workflow files. Do not make a workflow skipped by path filtering a required check: it can remain pending. If selective builds must be required, use job-level change selection with an always-run result gate. Manual edge dispatch remains available. Chart-only development changes currently also rebuild the edge image; separating that build is a follow-up.

For deployment/rollback, use the approved chart version and its immutable image digest; never move version tags. Validate locally with `bash tests/release.sh` (jq, yq v4, Git and semver required), `actionlint`, `helm lint` and chart rendering.
