# PR description template

Fill this in and drop sections that are empty. The `<!-- review -->` blocks are invisible on GitHub; they feed the code view (SKILL.md step 9). Don't add a type column or a mirrored checklist; the team asked for neither. Subtasks show their parent in brackets. Every Area names the impacted area ("Gateway", "DR (switchover)", "Platform (…)"), never "Neither" or "—".

````markdown
Promotes <N> commits from `release/<name>` (cut from `dev` at <sha>) to `master`, which deploys TEST on merge. PROD follows later through `deploy/prod/package-tag` and `deploy-sdx/prod`.

Changes are grouped by risk:
- **HIGH:** complex, or potentially high user impact.
- **MEDIUM:** needs a targeted check.
- **LOW:** straightforward, no specific validation needed.

Each HIGH and MEDIUM item has TEST and PROD boxes to tick as it's validated. "MISC" items are commits with no Jira ticket, grouped by theme. Each item lists its authors, whether it's user-facing, and the area it affects.

## 🔴 HIGH

- **⚠️ BLOCKER: [APS-1234](https://dpdd.atlassian.net/browse/APS-1234) <Jira title>**
  <Author(s)> · User-facing: **yes** · <Area>
  <What changes and why it breaks as merged.>

  **Fix first:** <what to change or hold>. **Then check:** <validation>.
  - [ ] TEST
  - [ ] PROD

- **[APS-2345](https://dpdd.atlassian.net/browse/APS-2345) <Jira title>**
  <Author(s)> · User-facing: indirect (<why>) · <Area>
  <What changes, where it runs, blast radius.>
  <!-- review
  files: terraform/workspaces/gold/versions.tf ~ bcgov-gwa-scheduler
  files: dockerfiles/dp-query-api/
  upstream: bcgov/gwa-api v1.0.51...v1.0.53 microservices/gatewayJobScheduler/
  -->

  **Check:** <specific validation steps>.
  - [ ] TEST
  - [ ] PROD

- **MISC: <descriptive group title>**
  <Author(s)> · User-facing: <…> · <Area>
  <…>

  **Check:** <…>.
  - [ ] TEST
  - [ ] PROD

## 🟡 MEDIUM

- **[APS-3456](https://dpdd.atlassian.net/browse/APS-3456) ([APS-3400](https://dpdd.atlassian.net/browse/APS-3400)) <subtask title>**
  <Author(s)> · User-facing: <…> · <Area>
  <…>

  **Check:** <…>.
  - [ ] TEST
  - [ ] PROD

For an env the change doesn't reach, replace that box with a note, e.g. `  - PROD: N/A (Gold prod has no SDX module)`.

If a risk level has no items, keep its heading and write one line under it, e.g. `None. Nothing in this PR needs a HIGH-level check.`

## 🟢 LOW (no specific validation needed)

| Item | Author(s) | User-facing? | Area | Notes |
|---|---|---|---|---|
| [APS-4567](https://dpdd.atlassian.net/browse/APS-4567) <title> | <…> | Not yet (dev only) | <Area> | <one line> |
| MISC: <group title> | <…> | No | <Area> | <one line> |

<!-- review
title: APS-4567 <short label>
row: APS-4567
files: <path> ~ <regex>
-->

<!-- review
title: <MISC group title>
row: MISC: <start of the group title as written in the table>
files: <path>
-->

## Gaps

- <anything not diffed or confirmed, and why>

## Original description

<only if someone else had written one: their text, unchanged>

_Prepared with the `release-pr-review` skill (<agent and model, if known>) on <date>._
````
