# Reviewer lenses

Each lens is a different way of attacking the change. A reviewer with one lens stays in it,
because the other lenses are covered elsewhere. A `quick` reviewer works through all three
in order.

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
