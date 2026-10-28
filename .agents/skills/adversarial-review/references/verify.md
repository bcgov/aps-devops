# Verification brief

Fill in the slots and give it to the verifier (a fresh subagent if possible). Pass the
candidates inline, or as a path to a JSON file if the list is long.

---

Other reviewers produced the candidate findings below for `git diff {{BASE_SHA}} {{HEAD_SHA}}`
in `{{SRC}}`. The change's requirements are:

{{requirements}}

Author claims (from the PR description; findings may dispute these): {{author_claims_or_none}}

Counterparts (check other repos or branches only at these versions): {{counterparts_or_none}}

Context: {{extra_context}}

Your job is to **refute** each finding. Assume it's wrong until the code proves it right.
A finding that survives a real attempt to disprove it is worth far more than one nobody
checked. Don't agree just to be agreeable, and don't refute just to refute. Follow the code.

Constraints: read-only. Don't edit, install, fetch, check out, or use the network. Don't
read PR comments or other reviews. Don't look at commits after `{{HEAD_SHA}}` in any repo.

For each finding:

1. Open the cited file at `{{HEAD_SHA}}` and read enough of the surrounding code, its
   callers, and the config to judge the claim. For a docs finding, also open the source
   the claim describes. Check guards, validation, framework defaults,
   or callers elsewhere that would prevent the failure scenario.
2. Check it is in scope: introduced or made worse by this diff (a new path to an old
   problem, or one made more likely), and not formatting, style, something a linter in
   this repo would catch, or a requirement delivered elsewhere.
3. Check for precedent, for every finding: search the repo for the same pattern (e.g. other
   reads of the same variable, other resources built the same way). If the repo already
   does the same thing the same way, decide which it is:
   - an **accepted convention**: a trade-off the repo relies on, such as required inputs
     that fail loudly when missing. Use `out-of-scope` and cite the precedent.
   - a **copied defect**, such as a missing auth check or an injection. It stays in scope,
     because a new instance is a new path, but name the other places it occurs.
4. If a cheap check would settle it, you may run it: an existing unit test, `terraform
   validate`, evaluating an expression, grepping for all call sites. Only if it needs no
   network or install and writes nothing to `{{SRC}}`; use a temp directory for caches
   and output (e.g. `--coverage=false`, `TF_DATA_DIR`). A prebuilt container image counts
   only if it was built from `{{HEAD_SHA}}` (check its labels or tag); run it without real
   secrets, `.env` files or long-lived services, and remove the container afterwards. Never write a
   new test into the checkout. If the check that would settle it can't run under these
   rules, say which check in `check_not_run` and don't use `refuted` on that basis.
5. Return a verdict:
   - `confirmed`: you traced the failure scenario through the code (or reproduced it) and
     it holds.
   - `plausible`: the code does what the finding says, but whether it fails depends on
     something you couldn't check: runtime data, deployment order, or a counterpart repo's
     state (especially an unmerged counterpart PR). **If the answer depends on another repo's
     version, use `plausible`, not `refuted`.**
   - `refuted`: the claim is wrong or the scenario can't happen. Cite the code or fact that
     disproves it.
   - `out-of-scope`: the mechanics are right, but it's pre-existing, an accepted convention
     (cite the precedent), style, or delivered elsewhere. Say which.

You may lower severity (say why). Raise it only with new evidence. A deploy or plan
that stops before changing anything, because a required input is missing or invalid, and
names it, is at most `minor` when supplying the input and re-running fixes it. That cap
doesn't cover tests that can't run, or failures that need a code or data fix.

Return a JSON array, one entry per input finding, in input order:

```json
[
  { "index": 0, "verdict": "confirmed | plausible | refuted | out-of-scope", "note": "evidence for the verdict, including any check you ran and its result", "severity": "blocker | major | minor", "check_not_run": "the check that would settle it and why it couldn't run, or null" }
]
```

Candidate findings:

{{candidates_json_or_path}}
