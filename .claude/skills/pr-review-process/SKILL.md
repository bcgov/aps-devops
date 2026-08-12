---
name: pr-review-process
description: Procedure for triaging merged findings from parallel PR reviewers (currently GPT and Claude), bundling fixes into at most 3 task branches (<10 files each), opening a PR per bundle, and summarizing everything back on the original PR. Used by the multi-model PR review GitHub Action.
---

# PR Review → Plan → Implement Process

You are running non-interactively in CI, on a checkout of the reviewed PR's head branch. Several
models already reviewed this PR's diff independently, each following the
[[review-response-format]] contract. Their raw outputs are on disk as JSON files. Your job is to
triage those findings, decide what's worth auto-fixing, implement it, and report back.

You have full `Bash`/`Read`/`Write`/`Edit` access and an authenticated `gh` CLI. Work directly in
the checked-out repo — do not ask for confirmation, this run is unattended.

## Inputs you'll be given in the prompt

- Paths to one findings file per reviewer, each shaped per [[review-response-format]] (a
  `parse_error: true` file means that reviewer's output wasn't valid JSON — treat its findings as
  empty but mention the failure in your final summary). Each file may also carry a top-level
  `usage` field — `{ input_tokens, output_tokens, total_tokens }` — added by the calling script,
  not by the reviewer model itself; it's absent if the provider didn't return usage data.
- The original PR number, its head branch, and its base branch.
- Who initiated this review run (as `Initiated by: @<username>`).

## Step 1 — Merge and rank findings

- Load every findings file you were given. If a file has `parse_error: true` or is missing, skip
  it and note the gap.
- Findings from different reviewers describing the same underlying issue (same file, overlapping
  lines, same root cause) are duplicates — merge them into one entry and record which reviewers
  flagged it. A finding flagged by 2+ reviewers is higher-confidence than a single-reviewer
  finding of the same severity; treat multi-reviewer agreement as a tiebreaker above severity
  order.
- Rank the merged list: `critical` > `high` > `medium` > `low`, with multi-reviewer agreement
  breaking ties within a severity tier.
- Drop findings that are pure style/taste with no concrete suggested fix, or that would require
  a design decision only a human should make (e.g. "consider a different architecture here").
  You are implementing surgical fixes, not redesigning the PR.

## Step 2 — Bundle into task groups

- Group the remaining ranked findings into coherent bundles — findings that touch the same
  subsystem/feature area belong together so each resulting PR tells one story.
- Hard constraints:
  - **At most 3 bundles total.** Take the highest-priority findings first; anything left over
    once you have 3 bundles (or once remaining findings are too risky/ambiguous to auto-fix)
    stays unaddressed — list it in the final PR comment instead of forcing it in.
  - **Each bundle must touch fewer than 10 files.** If a coherent group would exceed that, either
    split it into two bundles or drop its lowest-priority members until it fits — never exceed
    the limit.
- It's fine to ship fewer than 3 bundles, or a single bundle, if that's all the findings support.
  Don't manufacture busywork to hit 3.

## Step 3 — Implement each bundle

For each bundle, in priority order:

1. `git fetch origin <head_branch>` and branch from its tip:
   `git checkout -b task/<n>-<slug> origin/<head_branch>` where `<n>` is the bundle's 1-based
   index and `<slug>` is a short kebab-case description (e.g. `task/1-fix-auth-null-checks`).
2. Implement the fix for every finding in the bundle. Keep changes minimal and scoped to what the
   finding describes — this is a targeted fix, not a refactor. Match the surrounding code's style.
3. If a fast build/lint/test command is obviously available for the touched area (e.g. a
   `package.json` script, existing CI config you can read for the command), run it and fix
   anything it flags. Don't go hunting for a test suite that isn't obviously there, and don't let
   this block you if nothing fast is available.
4. Commit with a message summarizing the bundle and referencing each finding's `id`. Stage only
   the specific files you intentionally edited for this bundle (`git add <path>...`) — never
   `git add -A` or `git add .`. The working tree may contain files unrelated to any bundle
   (including this skill's own files, if they were staged into the checkout for this run) that
   must never end up in a commit.
5. `git push -u origin task/<n>-<slug>`.
6. `gh pr create --base <head_branch> --head task/<n>-<slug> --title "..." --body "..."` — the
   base is the **original PR's head branch**, not its base branch, so merging this task PR feeds
   the fix back into the PR under review. The body must:
   - Summarize what the bundle fixes, in prose.
   - List each finding addressed (id, file, severity, one-line description).
   - Say which reviewer(s) flagged each one.
   - Link back to the original PR (`#<original_pr_number>`).

## Step 4 — Report back on the original PR

Once all bundles are handled (or you've determined none are worth auto-fixing), post **one**
comment on the original PR via `gh pr comment <original_pr_number> --body "..."` containing:

- A short overview: how many findings each reviewer produced, how many were unique after merging.
- The findings grouped by severity, each with a one-line description and which reviewer(s) raised
  it.
- For findings that became a task PR: a link to that PR and its bundle number.
- For findings left unaddressed (over the 3-bundle cap, too risky, or design-level): a short note
  on why, so a human knows to look at them manually.
- A closing "Run info" line (or small collapsed `<details>` section, so it doesn't compete with the
  findings for attention): who initiated the run, and — only for reviewers whose findings file
  carried a `usage` field — each one's token usage, e.g.
  `gpt: 42,310 in / 1,204 out · claude: 38,750 in / 980 out`. Omit a reviewer from this line
  entirely if its file has no `usage` field; don't report zeros or guess.

Keep the comment skimmable — headings and bullet points, not a wall of prose. This comment is the
single source of truth for what happened during this review run.
