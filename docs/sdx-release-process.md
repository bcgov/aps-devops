# SDX builds and releases

The workflows build artifacts and create releases. Deployments remain separate.

## Components

`.github/release/components.json` lists each component's paths, Docker context and starting version. Components use independent `<component>/vX.Y.Z` Git tags. Images use `ghcr.io/bcgov/aps-devops/<component>:vX.Y.Z`; Helm uses OCI chart versions without `v`.

The only release helper is `.github/scripts/release-plan.sh`. It validates one `release=major`, `release=minor` or `release=patch` label, selects changed components using `git diff`, and increments their own latest stable tags with the standard `semver` CLI. Shared workflow changes select all components. An edge-image change also selects the chart. Dependency selection is independent of component order in the manifest.

Initial image versions start from 0.0.0; the chart starts from 0.3.11. Historical repository-wide tags are preserved.

## Branches and images

- Feature/dev pushes build through `.build.yml`; PR builds do not publish.
- Same-repository feature PRs into dev request `gh pr merge --auto --squash`; GitHub applies required checks/reviews. Drafts and forks are excluded.
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

## Edge image -> chart

Both stable releases and feature/dev/images/manual publications use `.edge.yml`: publish image, then publish chart. The chart job receives the exact image tag/digest. `.chart.yml` uses normal commands:

1. `yq -i` updates Chart.yaml version/appVersion/source annotation and values.yaml imageTag/imageDigest.
2. `helm lint` and `helm template` validate OpenShift/Kubernetes variants.
3. `helm package` creates the archive; `helm push` publishes it to GHCR OCI.

Branch/manual charts use `<source-chart-version>-dev.<GitHub-run-id>`; stable promotions use the chart's independently incremented version. PR builds skip publication. A chart-only release selects the latest published stable edge release, falling back to the existing appVersion before the first automated edge release. Reserved/unpublished edge tags are not selected.

The chart's two Kong containers use the image digest. Updated YAML and the package are workflow artifacts and stable release assets; generated changes are not committed back to trigger another build. On retry, an existing chart version must match the source annotation and image digest; `helm pull` retrieves that existing package instead of overwriting it. There is no custom archive normalization or receipt format.

## Failure, retry and rollout

Promote one dev -> main PR at a time and wait for its release workflow. A failed build can leave a reserved Git tag without a release; rerunning the same promotion retains its version. Existing released versions are skipped. Colliding image/chart identities fail. GitHub concurrency is one active/one pending, not a durable queue.

`gh release create` handles release asset upload. If an interrupted upload leaves a draft, inspect it and use standard `gh release upload`/`gh release edit --draft=false` commands to finish before retrying. There is no custom recovery service. Do not merge another promotion over a failed release without a recovery decision.

dev/main require reviews and passing build checks. Squash merges go into dev and merge commits into main. Auto-merge uses an App/bot token without bypass rights, so merged feature PRs trigger dev builds.

Build workflows use source-path filters, including their caller and reusable workflow files. Do not make a workflow skipped by path filtering a required check: it can remain pending. If selective builds must be required, use job-level change selection with an always-run result gate. Manual edge dispatch remains available. Chart-only development changes currently also rebuild the edge image; separating that build is a follow-up.

For deployment/rollback, use the approved chart version and its immutable image digest; never move version tags. Validate locally with `bash tests/release.sh` (jq, Git and semver required), `actionlint`, `helm lint` and chart rendering.
