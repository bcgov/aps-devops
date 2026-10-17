# SDX component build and release process

This workflow replaces repository-wide patch releases and moving major tags with independent SDX component releases. It builds artifacts and release notes; deployment remains an explicit environment operation.

## Components and versions

`.github/release/components.json` owns component IDs, source/build contexts, change dependencies and initial version baselines. Each APE function, brochure UI, edge image and edge chart releases independently. A change to a shared workflow/script/manifest conservatively affects every component. An edge-image change also releases the chart. Other changes outside component/shared paths do not release a component.

Tags are `<component>/vX.Y.Z`, e.g. `pubsub-kafka/v0.1.0`, `sdx-access-point/v0.1.0` and `sdx-edge/v0.3.12`. Images use `ghcr.io/bcgov/aps-devops/<component>:vX.Y.Z`; chart packages use OCI chart SemVer tags without `v`. Published tags and artifacts are never intentionally moved/overwritten. There is no repository-wide "latest" release or moving major version alias.

Image baselines are 0.0.0 (first patch -> 0.0.1); the chart baseline is 0.3.11. Verify these baselines against the registry before rollout and review any adjustment in the manifest. Historical unscoped Git tags are not imported into component version calculations.

## Feature and dev builds

APE, brochure and edge-image callers invoke `.github/workflows/.build.yml` on feature/** and dev pushes. The edge caller also retains images/** and manual build entry points. PR builds validate the images without publishing. All callers currently build conservatively on every qualifying branch/PR; release selection is component-specific.

Published development images use immutable `sha-<full-commit>` tags; builds with explicit build arguments append their SHA-256 fingerprint. This gives edge builds with different plugin versions distinct identities, even at the same source commit. A mutable branch alias, with unsafe Docker tag characters replaced by `-`, supports existing feature/dev consumers. Versioned release images use `vX.Y.Z`. The template emits revision/digest receipts and OCI revision metadata. If the immutable tag already exists, it must declare the same revision and build-argument fingerprint; the workflow reuses it rather than overwriting it. Base OS packages and external package registries can still change; pinning Git inputs is not a guarantee of fully hermetic builds.

`sdx/image/plugins.json` records the default plugins tag/ref and expected commit. Update both through a reviewed PR after selecting a released plugin bundle; moving default tags are rejected. The Dockerfile also pins gwa-kong-endpoint, gwa-ip-anonymity and priority-updater Git commits. Manual edge builds accept `plugins_ref` as a released tag or full commit; branch names are rejected. The shared edge workflow resolves tags (including annotated tags) and passes `KONG_PLUGINS_REF` and `KONG_PLUGINS_REVISION` as Docker build arguments. The Dockerfile verifies the expected revision, labels the image with the supplied reference/revision and writes the actual commit to `/usr/local/share/sdx/plugins-revision`. For direct Docker builds, pass `--build-arg KONG_PLUGINS_REF=kong-oss-plugins/vX.Y.Z`; the pipeline also supplies the resolved revision for verification. The current pin records the audited feature/mtls commit, not a newly published plugin release. The edge plugin inventory is aligned with the portal local SDX image and infrastructure control plane: `pep` and `plugin-log` replace the removed `openid-authzen` installation. Existing deployments that still configure `openid-authzen` need compatibility review before upgrading; this PR does not change deployed gateway configuration.

## Merge and release flow

1. Open a feature/** PR into dev. The metadata-only `feature-automerge.yaml` requests squash auto-merge for same-repository, non-draft PRs. It never checks out PR code. GitHub performs the merge after required reviews/checks pass. Fork PRs are handled manually.
2. Create a dev -> main promotion PR. Add exactly one of `release=major`, `release=minor` or `release=patch`. That increment applies to each affected component's own latest namespaced stable tag. Missing, unknown or conflicting release labels fail `Release policy / plan`. Different increments require separate promotions; component-specific increments are not supported in one PR.
3. Review the release-preview artifact and CI. Merge dev -> main with a merge commit, preserving the dev/main ancestry. Squash/rebase promotions are rejected by the release planner. Synchronize urgent fixes from main back into dev before another promotion.
4. The merged PR's exact merge commit is checked out. Image jobs publish affected component versions. Edge releases run through `.edge.yml`, which always chains image publication to chart metadata updates, validation, packaging and publication; chart-only releases use `.chart.yml` directly. Only after all artifact jobs succeed does the notes job create component GitHub releases/tags at that commit. Notes include scoped commit history, the promotion PR and artifact identities. Assets include digest receipts and chart packages. Draft GitHub releases remain draft if attachment upload fails.

The release orchestrator calls the reusable build directly. It does not rely on a tag created by GITHUB_TOKEN starting another workflow, which GitHub suppresses. See [GitHub token event behavior](https://docs.github.com/en/actions/concepts/security/github_token).

## Chart and edge-image compatibility

Chart CI lints/renders OpenShift and Kubernetes variants and verifies both init/proxy containers use `kong.imageDigest`. An empty digest preserves existing installations' Chart.appVersion behavior. Release packages always resolve and embed an immutable image digest.

Every edge image published by repository workflows—including feature/dev/images branch and manual builds—runs the same image-to-chart chain. The build returns its exact image tag and digest; after successful image publication, the chart workflow updates Chart.yaml `version`/`appVersion` and values.yaml `kong.imageTag`/`kong.imageDigest`, validates, packages, then publishes to GHCR OCI. PR builds do not publish images or charts.

Stable promotions use the independently computed chart release version and the edge image's vX.Y.Z tag/digest. Branch/manual publications use a unique prerelease chart version `<source-chart-version>-dev.<source-commit>.<image-digest-hex>`, so different plugin inputs cannot collide and preview charts do not replace stable releases. A chart-only release retains the previous chart release's recorded image/digest; the first automated chart release resolves the source Chart.appVersion once. Missing/mismatched prior release receipts stop publishing. An image upgrade without source changes requires an explicit reviewed change to the edge image input so both components are selected.

The chart source is staged under `.release-chart/sdx-edge` and its Chart.yaml/values.yaml are automatically updated before validation/packaging. Helm packages carry the computed chart version, selected appVersion and digest; the checked-in branch files and release commit are not rewritten. Exact updated YAML files are included with the workflow artifacts (and stable GitHub releases) for inspection; this avoids release commits triggering another build. Tar metadata is normalized for repeatable packaging. A previously published chart version must have the same package checksum or the job fails. The package receipt records source revision, chart checksum, OCI digest and selected image digest.

## Retry, promotion and rollback

Re-run the failed release workflow after resolving transient errors. A component tag at the same merge commit retains its version. Existing stable images/charts are checked and reused; published releases are verified and left unchanged. Draft release attachment uploads can resume. Colliding tags/revisions or artifacts fail closed. A partial release can leave artifacts or some component releases published; inspect the receipts and run results before retrying.

Promote only one dev -> main PR at a time and wait for its release workflow before merging the next. GitHub concurrency permits one active and one pending run; additional pending runs can replace an earlier pending run. Do not stack production promotions and assume a durable queue. An older failed promotion whose version ledger has advanced to a later, non-ancestor release is rejected and needs a reviewed recovery decision.

Deploy the same recorded chart/image digest through environments. Record environment approvals externally under the APS Technical Change Management Process. Roll back using the prior known-good chart package and its recorded image digest; do not move version tags. No workflow here runs Helm install/upgrade or changes cluster state.

## Activation checklist

Before merging/activating this draft implementation:

- Confirm initial versions, component boundaries and release labels under the APS Technical Change Management Process; create the three release labels if absent.
- Enable repository auto-merge and squash merging, allow merge commits for promotions, and configure dev/main protections with required reviews and CI. The auto-merge workflow checks the classic dev protection endpoint for required checks/reviews and fails closed if absent; ruleset-only protection requires adapting that check.
- Configure `AUTOMERGE_TOKEN` using a suitably scoped GitHub App installation token or bot credential. It must allow reading classic branch protection and enabling/performing PR merges; do not use a bypass/admin merge path. The eventual merge must trigger dev builds. The workflow accepts a token secret; provisioning/refreshing an installation token is external to this change.
- Require image validation jobs, `SDX chart validation / chart`, `Release tooling tests / planner`, and `Release policy / plan` where applicable. Require current plugin Busted/integration checks before upgrading the edge plugin revision.
- Verify GHCR publishing rights for each package and contents-write rights for release creation. Rehearse with nonproduction publication credentials/versions before production rollout.

At audit time (October 16, 2026), aps-devops auto-merge was disabled and the classic dev protection endpoint reported "Branch not protected". This PR does not change settings, secrets, permissions or deployment state.

## Local validation

Run `python3 -m unittest discover -s tests/release -v`, `actionlint`, `helm lint sdx/chart/sdx-edge` and the chart render commands in `.github/workflows/sdx-chart.yaml`. Tests cover version increments, labels, isolation, retries/collisions, merge ancestry, attachment failures, plugin tag/commit resolution and moved-tag rejection, and the staged image-to-chart pipeline with real Helm packaging and mocked registry publication. A passing local run is not a live registry/release rehearsal.
