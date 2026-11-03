# Team workflow

How a PR goes through AI pre-review before human review. Both skills point here: use it
to tell an author or reviewer what happens next. Pre-review catches what a peer review
with AI would otherwise catch later, so human reviewers can spend their time on design,
intent and judgment calls.

## Steps

1. **Author** opens a draft PR. The PR title or branch name carries the Jira key, and the
   description says which AI assistant and model, if any, wrote the change.
2. **Author** asks for a pre-review in APS Developer chat.
3. **Each teammate** runs `adversarial-review` on the PR, in a fresh session,
   on a model different from the author's.
4. **The skill** runs 1–3 reviewers, then a verifier that tries to refute each finding,
   then posts one PR comment.
5. **Author** runs `adversarial-review-consolidate` once the reviews are in. It merges
   them into one PR review with an inline thread per finding, and hides the original
   review comments.
6. **Author** replies **Fix**, **Ignore: <why>** or **Defer: [JIRA-TICKET]** in each
   thread, and makes the fixes.
7. **Author** runs `adversarial-review-consolidate` again, which records the decisions
   in the summary review.
8. **Author** updates the PR description to match the change as it now stands.
9. **Author** marks the PR ready and requests human review from the team.
10. **After merge**, anyone can run `adversarial-review-consolidate <PR> misses` to list
    what human reviewers caught that pre-review missed, and feed that into
    `references/lenses.md`.

## Telling someone what comes next

When a skill finishes, or someone asks where a PR is in this process, name the next step
from the list above and who does it. Work it out from the PR's state:

| PR state                                                        | Next step                                                       |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| No `adversarial-review:v1` comments                             | Step 2 or 3: ask for, or run, pre-reviews                       |
| Review comments, no consolidated review                         | Step 5: author runs consolidate                                 |
| Consolidated review with findings that have no decision         | Step 6: author replies in each thread                           |
| Every finding has a decision, but the summary doesn't show them | Step 7: author runs consolidate again                           |
| Summary shows every decision                                    | Steps 8–9: update the PR description, then request human review |
| PR merged                                                       | Step 10: run `misses` if the team is collecting them            |
