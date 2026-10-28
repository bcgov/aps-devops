# Reviewer lenses

Each lens is a different way of attacking the change. A reviewer with one lens stays in it,
because the other lenses are covered elsewhere. A `quick` reviewer works through all three
in order.

There are two sets. The **code lenses** (Failure modes, Contracts & rollout, Intent &
simplicity) are for code, config and agent instructions. The **docs lenses** (Accuracy,
Followability, Consistency) are for docs-only changes. Step 3 of `SKILL.md` picks the set.

# Code lenses

## Failure modes

What actually breaks? Assume the happy path works and go after everything else.

- What inputs, states, or sequences give a wrong result, a crash, or a hang? Empty, null,
  duplicate, very large, unicode, timezone/DST, clock skew, retries.
- Partial failure: if step 2 of 3 fails, what state is left behind? Is the result
  silently treated as success (empty list, `{}`, default value, swallowed exception)?
- Partial data written as complete: for every write (PUT, upsert, replace), trace each
  field back to the read that produced it. If that read can fail and fall back to `[]` /
  `{}` / null, the write overwrites good data with nothing. Guarding only the delete or
  cleanup step is not enough.
- State combinations: when the change reads or writes status flags (approved, active,
  enabled, deleted, ...), list every combination and transition it can produce: approve,
  re-approve, deactivate, re-submit with the same or changed data, the last item removed.
  Check what each one does downstream (hooks, provisioning, deletes).
- Blast radius of strictness: when new validation throws, does one bad row fail the whole
  batch, integration, or request, including delete and revoke paths that must still work?
- Does it fail closed or fail open? Is a fallback hiding a real error?
- Ordering and concurrency: two runs at once, retries, re-entrancy, out-of-order events,
  non-idempotent writes.
- Resource and lifecycle problems: leaks, unbounded growth, missing timeouts, missing
  cleanup on error paths.
- Do the tests exercise the failure paths, or only the happy path? Would they catch the
  bug you just found?

## Contracts & rollout

What breaks at the boundaries, or when this ships?

- Interfaces between components, services, or repos: request/response shapes, schemas,
  headers, env vars, config keys. Does every producer and consumer agree? Are
  both sides changed, and does the order they deploy in matter?
- Config and IaC: typos that are silently ignored (`try()`, `lookup` with a default,
  `.get(key, {})`), environment drift (dev vs test vs prod), missing validation.
- Validation that lets empty values through: `!= null`, `is not None`, `'key' in obj`,
  `hasOwnProperty` and "required" checks still pass `null`, `""`, whitespace, `[]`, `{}`
  and lists containing `""`. For each new input, field or variable, ask what happens with
  each of those, both when it's absent and when it's present but empty.
- Sibling consistency: when the change sanitises, strips, validates or overrides some
  fields, headers or keys, list every sibling of the same kind (e.g. all caller-identity
  headers, all env-specific settings) and check each gets the same treatment. Note
  semantics like "add only if absent" vs "replace".
- What ships: does the build artifact (image, package, chart) now include test fixtures,
  sample data, dev config, debug tooling or secrets? Is something it needs at runtime missing,
  e.g. a new table or column with no schema or migration?
- Deploy, migration and rollback: does it work while the old version and the new version
  are both live? Can it be rolled back? Are migrations reversible and safe on real data?
- Cross-repo ordering: if a counterpart validates strictly (a schema that rejects unknown
  attributes, a required field), which side must deploy first, and is that written down?
  Check counterparts at the version named in your brief, never a later one.
- Security: authn/authz on new paths, scope/permission checks, secrets in code or logs,
  injection, trusting caller-supplied identity, CORS, TLS.
- Operability: will on-call be able to tell when this is broken (logs, metrics, error
  messages that name the cause)?

## Intent & simplicity

Does this change do what it is for, and nothing it shouldn't?

- Go through the acceptance criteria one at a time. Which are unmet, half met, or met only
  in the tests?
- Attack the author's claims. For each one ("on failure, X still happens", "behaviour is
  unchanged for a single URL"), check that the code really does it, and that doing it is
  safe. A claim can be accurate and still describe a bug.
- Is there behaviour in the change that the intent didn't ask for, especially anything
  that widens access, changes defaults, or touches unrelated areas?
- Is there a materially simpler way to get the same result: less code, fewer moving parts,
  or reuse of something already in the repo? Report it only if the simpler path is concrete
  and the extra complexity carries real risk. "Could be cleaner" is not a finding.
- Do docs, examples, and comments that the change touches still tell the truth?

# Docs lenses

The source of truth for a doc is what it describes: the code, config, schemas, CLI help
and counterpart repos (at the version in your brief), not other docs. Find it before you
judge a claim. A docs finding still needs a failure scenario: *a reader does what the doc
says → this goes wrong*. A claim you can't trace to any source isn't a finding.

## Accuracy

Is every claim the change makes true of the system it describes?

- Commands, flags, config keys, env vars, file paths, ports, API routes and fields: find
  each in the source and check the name, spelling and shape match.
- Defaults, limits, versions, and "required" or "optional": check the code that sets them.
- Examples: would the sample config or request pass the real schema or validation? Would
  the code block run against the current interface?
- Behaviour descriptions ("retries three times", "deleting X also removes Y"): trace the
  code path, as the Intent lens does for author claims.
- Version drift: does the doc say which version it describes, and is that still current?

## Followability

Can the intended reader do the task from this doc alone, as written?

- Walk the steps in order as the stated audience. What do they need that the doc doesn't
  give them: access, tools and versions, env vars, which cluster, namespace or account,
  which directory to run from?
- Order: does any step depend on something done later, or on state an earlier step
  didn't create?
- Placeholders: is each `<value>` explained, with where to get it?
- Commands that fail as pasted: wrong shell for the platform, missing line continuations,
  smart quotes, a prompt (`$`) inside the block.
- Outcomes: can the reader tell a step worked, and what to do if it didn't? Destructive or
  production steps need a warning, a check first and a way back.
- Harm: does following it leak a secret (shell history, logs, a URL), turn off TLS
  verification, grant more access than the task needs, or target production by default?

## Consistency

Does the change agree with itself, the rest of the docs, and its intent?

- Search the repo for other pages on the same topic, command or setting. Does the change
  contradict them, or leave them stale (a renamed thing, a changed default, a removed
  step)?
- Within the change: the same name, value and version for the same thing everywhere;
  step numbers and cross-references still point at the right place.
- Links and anchors the change adds or touches: do the targets exist in the repo at
  `HEAD_SHA`? You can't check external links offline; leave them.
- Intent: go through the acceptance criteria one at a time. Does the change publish
  anything it shouldn't, such as internal hostnames, credentials or personal data in a
  public repo?
