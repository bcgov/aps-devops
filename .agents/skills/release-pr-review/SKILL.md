---
name: release-pr-review
description: Review and write up an api-serv-infra promotion PR (release/<name> or dev → master) - Jira tickets, env scope, risk with TEST/PROD checks, and an HTML code view. Run with /release-pr-review <PR number>.
disable-model-invocation: true
---

# Release PR review (api-serv-infra)

This produces a reviewer-ready description for a promotion PR in `bcgov-c/api-serv-infra`. The output is a list of every change, grouped by risk. Each HIGH and MEDIUM item gets its own TEST and PROD checkboxes, so the team can tick validation off as the release is promoted.

Run it from an api-serv-infra clone: `/release-pr-review 377` (add "dry run" to write the description to a local file without editing the PR).

The skill lives in aps-devops `.agents/skills` but runs against a clone of `bcgov-c/api-serv-infra`: run the `git` commands and `scripts/review_page.py` from that clone. Resolve `references/` and `scripts/` relative to this file's directory. From another workspace, reference this SKILL.md explicitly if it isn't in the available skill catalog.

Only run this against api-serv-infra. Before anything else, check `git remote get-url origin` in the working directory points at `bcgov-c/api-serv-infra`. If it doesn't, stop and ask for the path to an api-serv-infra clone instead of reviewing whatever repo you're in.

The value is in the checking, not the summary. Commit messages like "bump switchover" or "update sdx versions" hide real behaviour changes. The infra config can also run ahead of the component releases it relies on, and a plain summary misses both. So for every version bump, look at what the new version actually changes, and for every config change, check that the code being deployed to that env reads it.

## Workflow

### 1. Collect the commits and the net diff

```bash
gh pr view <N> --repo bcgov-c/api-serv-infra --json title,body,state,baseRefName,headRefName,baseRefOid,headRefOid,mergeCommit
git fetch -q origin master dev
```

Pick the range from the PR's state. Use the PR's own head branch: release PRs come from a `release/<name>` branch cut from `dev` (e.g. `release/post-m1` → `master`), so `dev` itself may have moved on.

- **Open PR:** commits are `origin/<base>..origin/<head>`. To get what will land, build the merge result and diff the base against it:
  ```bash
  git fetch -q origin <head>
  T=$(git merge-tree --write-tree origin/master origin/<head> | head -1)   # prints conflicts after line 1, if any
  git diff origin/master "$T" -- <paths>
  ```
- **Merged PR:** commits are `<baseRefOid>..<headRefOid>`. What landed is `git diff <baseRefOid> <mergeCommit>`.

Then list the commits with git, not `gh`, because `gh pr view --json commits` stops at 100:

```bash
git log --no-merges --reverse --format='=== %h | %an | %s%n%b' --stat=140 <range>
```

Read both views. Single commits show intent and authorship. The merge-result diff shows what actually lands, since later commits often revert or change earlier ones. Don't use the two-dot or three-dot diff for this. When master has its own commits (hotfixes, cherry-picks), both get it wrong. In PR 311, the two-dot diff showed test/prod Patroni being downgraded, but the merge kept the newer tag.

Quote revision paths: `git show "${SHA}:terraform/…"`. In zsh, an unquoted `$H:t…` triggers the `:t` modifier.

### 2. Jira titles, types and parents

Collect every `APS-####` key from the commit subjects and bodies, then fetch them all in one call. With the Atlassian `twg` CLI (load its skill first if your agent has one):

```bash
f=$(twg jira workitem get APS-1 APS-2 ... --fields summary,status,assignee,issuetype,parent -o json 2>&1 \
  | sed -n 's/^ *stdout: "\(.*\)"/\1/p' | head -1)
jq -r '.data
  | if type == "object" and has("items") then [.items[] | select(.ok) | .data]
    elif type == "array" then . else [.] end
  | .[] | [.key, .summary, .issuetype.name, (.parent.key // ""),
           (.parent.summary // .parent.fields.summary // "")] | @tsv' "$f"
```

`twg` prints a YAML-ish envelope rather than JSON. The real JSON is in the file named on its `stdout:` line, so read that file instead of piping the output to `jq`. The shape of `.data` depends on how many keys you pass, and the parent's title can sit under `.parent.fields.summary`; the `jq` above handles both. Any other Jira access works too; if none is available, list the keys without titles and say so under Gaps. Jira links are `https://dpdd.atlassian.net/browse/<KEY>`.

The author is the commit author (and any co-authors named in the commit). Use people's names, not GitHub handles, where Jira or git gives one.

You use the issue type only to format subtasks. Show a subtask as `[APS-4991](…) ([APS-4924](…))`, with its parent in brackets. Don't print a type column. The team found it noise.

### 3. Work out which envs each change actually reaches

Most mis-rated changes come from getting this wrong. Read [references/deploy-scope.md](references/deploy-scope.md) for how this repo maps files to envs: `dev_versions` vs `test_and_prod_versions`, `count` guards, Emerald's per-env values, the SDX workspaces with their separate deploy workflows, and the gateway config files that `kong-init` pushes.

Three traps came up in dry runs:

- **The image tag in the resource wins.** A resource can override `versions.tf` (e.g. `tag: ${var.workspace == "test" ? "test" : local.versions…}`), so a bump in `test_and_prod_versions` may only change prod. Read the `tag:` line of each resource you're rating.
- **Check every resource around a dev-only component.** A deployment can be guarded with `count = var.workspace == "dev" ? 1 : 0` while its route, secret or ConfigMap in the same file isn't. Those siblings then get created in test and prod with nothing behind them.
- **Some resources don't re-apply.** `lifecycle { ignore_changes = all }` (e.g. `app-postgresql-init-db.tf`) means edits only take effect in a brand-new env. Rate the change for what it does to existing envs, which is usually nothing, and say so.

A change that only reaches dev is LOW in this PR, whatever it does. Say "dev only" and move on.

### 4. Look upstream behind every version bump

For each image or chart tag that changes in test/prod, diff the component repo between the old and new tags. [references/component-checks.md](references/component-checks.md) has the repo, compare command and known traps for each component: switchover-agent, gwa-api, api-services-portal, the sdx-edge chart, ca-token-api, and dp-query-api.

Two checks find the blockers:

- **Config ahead of code.** Infra often sets env vars or URL formats that only unreleased component code understands. For each new env var or changed value in test/prod, check whether the release tag being deployed reads it (contents API at the tag, not code search). If it doesn't, the change is **inert**: it's LOW, and needs validating with the next component release. If the old code would *misread* it, for example a comma-separated URL list fed to code that expects one URL, it's a **blocker**.
- **Value outside the chart's lookup table.** When a chart indexes a map by env name (`index .Values.x_by_env .Values.environment`), check that the new env name is a key in the *pinned* chart version. A missing key renders an empty URL without any error.

### 5. Rate the risk

- **LOW:** really straightforward, and doesn't need a specific check as it's promoted. Dev-only changes, docs and reference files, inert config, rebuilds with no source change, small resource bumps, and non-breaking API changes such as new optional response fields or doc wording.
- **MEDIUM:** needs a targeted check in that env, but the blast radius is limited or the failure is obvious. Examples: a DB migration with pre-checks, a chart flag that changes rendering, label or metric format changes, additive API endpoints, log pipeline changes (new outputs or volume, e.g. Fluentd copying every record to stdout), and **new public services or routes**. For a new public service, check its rate limiting, auth and log level (`DEBUG` in prod is worth calling out).
- **HIGH:** complex, or potentially high user impact. Examples: rewrites of components on the request path or the route-sync path (dp-query-api, gwa-scheduler), anything that can delete routes or services, DR and switchover behaviour (latent: it only runs during an outage, so a bug shows up at the worst time), **breaking public API changes**, and blockers.

For public API changes, ask whether an existing client that changes nothing could start failing or behaving differently. Removed or renamed fields, a changed response or error body shape, changed status codes, new required inputs, and new auth or validation that rejects requests that used to work are all breaking, so HIGH. New endpoints and new behaviour are MEDIUM. New optional fields are LOW, unless the code that produces them can throw on the public path.

Mark a blocker "⚠️ BLOCKER" and list it first under HIGH, with a **Fix first:** line before the **Then check:** line.

Don't inflate. The team's bar for LOW is "really doesn't need validation", so a reviewer's time goes to the items that do.

### 6. User-facing and area

- **User-facing?** Answer "yes", "no", "not yet (dev only)", "dormant", "marginal" or "indirect (…why…)". Internal platform, ops and dev-only work is not user-facing. A change that protects users without changing what they see is "indirect".
- **Area:** name the impacted area. Don't write "Neither" or "—". Examples: Portal, SDX, SDX (Portal) for the SDX-only paths of Portal such as the provisioner API, feeder or SDX notifications, Portal and SDX, Gateway, DR (switchover), DevHub, DNS (ops), Platform (observability, housekeeping).

### 7. Group MISC commits

Lump every commit with no Jira key by theme, whether or not it has a `MISC:` prefix. Older PRs often have no prefixes and only one or two keys in 100+ commits, so most of the review is MISC grouping. Examples: an SDX release bump, SDX sandbox/org config, gateway DP tuning, observability and housekeeping. Give each group a descriptive title. A MISC bump that hides a real change, such as switchover, gets its own item.

### 8. Write the PR description

Use the template in [references/pr-description-template.md](references/pr-description-template.md). The shape matters because GitHub only makes `- [ ]` clickable in list items, not in table cells. So HIGH and MEDIUM are list items with nested TEST/PROD boxes, and only LOW (no boxes needed) is a table. Don't add a separate mirrored checklist; the team didn't like the duplication.

While writing each item, add a hidden `<!-- review … -->` block that says which code it covers. Put it inside the item, after the body and before the blank line above **Check:** or **Fix first:**. For LOW rows, keep the table and put one block per row after it (a table cell can't hold one). Give each a `row:` key, the text that row's first cell starts with, and the page shows its code in a full-width row directly under that row. The template shows both. Block syntax:

- `files: <path, dir or glob>` takes everything changed there. `files: <path> ~ <regex>` keeps only the changed lines that match, for shared files like `versions.tf` or chart values. Narrow globs to the files you mean: `charts/ ~ memory` would also match the deleted Kong 2.29.0 chart.
- `upstream: <owner/repo> <old>...<new> [path-prefix …]` for a component bump. The page only links to it, because upstream diffs can be huge.
- `title: …` labels the code panel.
- `row: …` (LOW blocks) is the start of that row's first cell, e.g. `row: APS-4772` or `row: MISC: Gateway DP tuning`. If it's missing, a title starting with a Jira key is used. A key that matches no row leaves the panel below the table, with a warning at the top of the page.

GitHub doesn't render these comments, so they cost reviewers nothing on the PR. They're what step 9 uses to build the code view.

Before overwriting an existing description, read the live one. If any boxes are ticked (`- [x]`), carry those ticks over to the new version. Keep any existing `<!-- review -->` blocks unless you're deliberately changing them. If someone else wrote text there, such as the original author's summary, keep it under a "## Original description" heading at the bottom, unchanged. Re-read the live body right before `gh pr edit` and stop if it changed since you read it. Then:

```bash
gh pr edit <N> --repo bcgov-c/api-serv-infra --body-file <file>
gh api repos/bcgov-c/api-serv-infra/pulls/<N> -H "Accept: application/vnd.github.full+json" \
  --jq '.body_html' | grep -o 'task-list-item-checkbox' | wc -l   # expect 2 × (HIGH + MEDIUM items)
```

Write the body file in a temp directory, not the repo.

### 9. Build the code view

[scripts/review_page.py](scripts/review_page.py) turns the PR into one HTML page. It shows the description as GitHub renders it, and each mapped item gets a **Code** panel with:

- the net change it makes (from the merge result, so it's what lands)
- the commits that touched it, each expandable to its own diff
- links to any upstream compare and the upstream PRs in it

At the end, **Not covered by any item** lists every changed line that no block claims. Use it as a coverage check: each leftover is either a change the description should mention (add a LOW row or a Gaps line) or a mapping you missed. In PR 377 it surfaced two undocumented dev-only `sdx-reference-impl` bumps.

Run it from the api-serv-infra clone, with `<skill>` being this skill's directory:

```bash
python3 -I <skill>/scripts/review_page.py <N> -o <tmp>/pr<N>-review.html                     # standalone file, to share anywhere
python3 -I <skill>/scripts/review_page.py <N> --fragment -o <tmp>/pr<N>-review.html          # body only, for hosts that add <html>/<head> (e.g. Claude Artifacts)
python3 -I <skill>/scripts/review_page.py <N> --body-file draft.md -o <tmp>/preview.html     # preview mappings before editing the PR
```

It needs only python3, git and an authenticated `gh`, so anyone can rerun it after the description changes. How to share the page:

- **Agent hosts that publish HTML** (e.g. Claude Artifacts): publish the `--fragment` output, reusing the same path or URL on each rebuild so the link stays the same. These pages are usually private until shared.
- **On the PR:** GitHub won't accept `.html` attachments, so zip the standalone file and drag the zip into a PR comment.

The TEST/PROD boxes stay in the PR. The page shows their state when it was built and links back to the PR for ticking.

### 10. Title

If the title is generic, suggest one built from the two or three main themes, keeping any milestone framing the team already uses, e.g. "Post-M1: SDX SP139 rollout + gateway route-sync hardening (APS-5036)". Rename only when the user agrees.

### 11. Report back

In chat, lead with the blockers and the HIGH items, then link the PR. List the gaps: anything you couldn't diff (moving tags like `:dev`) or confirm (whether a namespace is live). Fixing blockers is a separate step; offer it, don't do it unasked.

## Installing

Install this per repo, not per user, so it costs nothing in other repos. Symlink it from an aps-devops checkout that tracks `dev` into the api-serv-infra clone, and keep it out of that repo's git:

```bash
cd <api-serv-infra clone>
mkdir -p .claude/skills
ln -s <aps-devops checkout>/.agents/skills/release-pr-review .claude/skills/release-pr-review
echo '.claude/skills/release-pr-review' >> .git/info/exclude
```

Pulling aps-devops then updates the skill. `disable-model-invocation: true` keeps it out of Claude Code's automatic skill list, so it costs no context until someone runs `/release-pr-review <PR>`. Agents other than Claude Code may ignore that field; for them, symlink into whichever skills folder they read instead.
