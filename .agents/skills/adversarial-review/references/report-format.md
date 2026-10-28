# Report format (Markdown)

Keep it short on the page. Only the header, notes, summary and findings table are shown;
everything else is collapsed, so a review comment stays small on the PR until
`adversarial-review-consolidate` replaces it. The local `.md` file is the same text.
GitHub needs a blank line after each `</summary>` and before each `</details>` for the
Markdown inside to render.

```markdown
## 🤖 AI pre-review: <repo>#<pr> @ <head_sha:7> — <model>, run by @<human>

**Skill:** adversarial-review · **Agent:** <agent> · **Author model:** <model> (<same family | different family>) — or "unknown"
**Tier:** <tier> (<reason, incl. risk-bump trigger>) · **Lenses:** <lenses> · **Intent:** <strength> (<sources>)

<Include each note that applies, one line each:>
> **Note:** Same model family as the author. Weaker independence; a teammate on a different model should also review.
> **Note:** Author model unknown. @<author>, please state which assistant and model (if any) wrote this in the PR description, so reviewers can pick a different one.
> **Note:** Self-review. The person running this review authored the PR.
> **Note:** Reviewed <head_sha:7>, but the PR head is now <pr_head_sha:7>. Later commits may address these findings.
> **Note:** Incomplete: <lens not covered / reason>.

**Summary:** <2–4 sentences: overall merge risk, the most important problem, and anything
the reviewer couldn't check, e.g. checks not run (from `scope.checks_not_run`), linked
docs not read.>

| ID | Sev | Conf | Location | Finding |
|---|---|---|---|---|
| F1 | blocker | high | `path/file.ts:123` | <title> |
| F2 | major | medium | `infra/main.tf:40` | <title> |
| F3 | minor | high | `src/x.ts:9` | <title> |

<details><summary>Blocker and major details (<n>)</summary>

### F1 · <title>
**<severity> · <confidence> confidence · <category> · <lens(es)>** — `path/file.ts:123`

<evidence: 1–3 sentences. If several lenses found it independently, say so.>

**Fails when:** <failure_scenario>

**Suggested fix:** <suggested_fix>

**Verification:** <verdict>: <note> <If the verifier changed severity: "(reviewer said major)">

<... one section per blocker/major ...>

</details>

<details><summary>Minor findings (<n>)</summary>

- **F3** `src/x.ts:9`: <failure scenario in one sentence>. *Fix:* <one line>. (<confidence>)

</details>

<details><summary>Intent used for this review</summary>

Requirements, acceptance criteria, author claims tested, parts delivered elsewhere,
counterparts with the versions checked, and linked docs not read.

</details>

<details><summary>Dropped in verification (<n>)</summary>

- [refuted | out-of-scope] <title> (`file:line`, was <severity>): <reason>

</details>
```

Leave out a collapsed block that would be empty, except "Dropped in verification".

When posting (SKILL.md Step 7), the comment is this report followed by
`<!-- adversarial-review:v1 -->` and the JSON in a collapsed
`<details><summary>Machine-readable review</summary>` block. Nothing else is shown.

Author decisions (fix / ignore / defer) are not recorded here. They go in reply to the
inline threads of the consolidated review from `adversarial-review-consolidate`, even when
there is only one review.

If there are no findings, say so plainly in the summary ("No problems survived
verification"), list what was checked (lenses, notable areas), and still include the
dropped-in-verification section.
