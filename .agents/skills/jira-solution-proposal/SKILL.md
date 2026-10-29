---
name: jira-solution-proposal
description: Review a Jira ticket and relevant repositories, prepare a one-page solution proposal with an editable D2 architecture diagram highlighting expected component changes, and attach the proposal to the ticket when requested.
---

# Jira solution proposal

Prepare a concise, reviewable solution proposal before implementation. This is a
proposed APS-5027 workflow; using it does not mean the team has approved either
the convention or the solution. Accept a Jira key/URL and any supplied architecture
reference. Default deliverables are a one-page A4 portrait PDF and its editable
`.d2` source. Preserve the proposal source alongside the outputs.

## Establish the proposal

Read the ticket description, acceptance criteria, linked design/retrospective
material and relevant discussion through available Jira tools. Identify the
problem, intended behavior, constraints and unresolved decisions. Inspect the
relevant repository instructions, current code and existing branches/PRs before
proposing new work. Do not treat a ticket snapshot or a branch name as current
remote evidence. Record access gaps explicitly; do not invent ticket content.
If the ticket cannot be read, use supplied material to prepare a clearly labeled
local draft, and identify what must be verified before attachment.

Build a working change map with one row per affected repository/component:
component ID, repository/path, current behavior, proposed change, change kind
(add/modify/remove), reason/evidence, dependency and validation. Separate confirmed
scope from assumptions. Include components needed for context without implying
that they change. This map drives both diagram styling and the bottom summary;
do not manually maintain conflicting lists of affected components.

## One-page composition

Use a compact title strip with ticket key/link, proposal title, date/revision and
“Proposed — pending review”. Place the architecture diagram at the top, immediately
below the title strip and before all prose or tables, within the first third of
the usable page, including its legend. Reserve the remaining two thirds for:

- A short problem and intended outcome, understandable without opening Jira.
- A compact repository/component table: proposed change, dependency/order and
  validation. Use short, action-oriented bullets in the proposed-change cells,
  one distinct change per bullet. Keep Portal application, feeder and provisioner
  impacts separate when applicable. State only the unique scope for each component.
  Describe what will change and the resulting capability or constraint, not the
  implementation recipe. Keep field names, algorithms, commands, migration steps
  and rollout actions in evidence/validation notes only when needed for review.
- Material assumptions, open decisions and rollout/rollback constraints. Separate
  review/merge order from artifact/deployment order when they differ.
- A small footer identifying the known AI provider/model and preparation date;
  include reasoning effort or precise model version only when exposed by the
  runtime. Otherwise state "Model identifier not exposed"; never infer a version.

Keep the text readable at print size (aim for 10–11 pt body text). Shorten content
rather than shrinking text or spilling onto a second page. Put detailed evidence
in a companion local source record if needed; the page must stand on its own.
Mark unexecuted checks as planned. Never imply an approved design or completed
validation merely because a proposal was generated.

## D2 diagram and automatic highlighting

Use D2 as the editable source and render locally to SVG. Read
[editing-diagrams.md](references/editing-diagrams.md) for template editing,
component inventory and generation commands. Preflight the D2 renderer, PDF
renderer and Jira upload capability; continue useful local drafting when upload
is unavailable and report the gap.

Start with `assets/architecture-template.d2` or a user-supplied D2 template.
`assets/master-components.json` is the editable master component inventory.
Preserve stable IDs. Select only relevant context and affected components for the
page. Treat the user-maintained inventory as authoritative for component identity,
labels and repository ownership. Do not create or extend a ticket-local master
list to legitimize invented components. Keep the shared inventory current under
the user's standing request: reconcile confirmed component additions, ownership,
paths and responsibilities against current code/documentation during proposal
research. Preserve stable IDs and record evidence and review date in
`references/component-inventory.md`. Mark proposed components as planned, never
as deployed. Update the shared inventory and relevant templates together when
needed; do not promote a ticket-specific implementation area into a component.
If evidence conflicts or access is missing, record the gap rather than guessing.
Do not rewrite a user's reusable template to apply a ticket's highlights.

Build a ticket change map (see `assets/APS-4927-changes.json` for an example) and run
`scripts/prepare_diagram.py` against the template/inventory. It generates a
self-contained `.d2` copy and `.summary.json` from the same changes. Use those
summary rows for the bottom table. Map implementation areas to their existing parent component. Put their names
in optional `subcomponent` text. Keep the left column to repository/component;
put `<subcomponent>: <changes>` in the proposed-change column. Use the generated
`proposed_change` value. Subcomponents never become standalone diagram nodes. When no existing
component fits, use a repository-only row/node from an existing master repository;
record the inventory gap instead of inventing a component. The helper rejects unknown or absent
nodes and duplicate changes. Current helper scope is top-level node IDs; preserve
that scope or extend it explicitly before introducing nested component paths.

Use component names alone in node labels, including "SDX Provisioner Partner API".
Explain status in a legend: amber solid for expected changes, green for additions,
red dashed for removals, amber dashed for agreement needed, and gray for context.
Preserve line-style distinctions and include the status in companion summary data.
Do not prefix component labels with CHANGE, NEW, REMOVE or TBC. Highlights indicate expected changes, not approval or deployment.

Render the generated D2 through the local CLI and embed its SVG/PNG export in the
PDF. Keep that exact `.d2` as the editable attachment. Verify all affected summary
rows map to highlighted nodes and vice versa. Use available PDF tooling to check
one page, top-of-page diagram placement, ticket hyperlink and model attribution;
visually inspect labels, clipping and the one-third/two-thirds
balance. If rendering fails, preserve source and report the limitation; never
silently substitute a separately drawn diagram and claim native D2 export passed.

## Attach and report

When the user asks to run the complete ticket-proposal workflow, attaching the
finished PDF and `.d2` source is part of that request. Respect any draft-only
instruction. Creating this skill is not authorization to attach a proposal to an
unspecified ticket or post a comment.

Use the available Jira attachment capability and verify the destination ticket
identity before upload. Name outputs `<KEY>-solution-proposal-r<N>.pdf` and
`<KEY>-solution-proposal-r<N>.d2`. Inspect existing attachments to select the
next revision and avoid duplicates; preserve earlier proposals. After an unknown
upload outcome, inspect attachments before retrying. Confirm both attachment IDs
or links through read-back. Do not alter ticket status, description, assignees or
comments unless requested. If attachments are unavailable or verification fails,
keep the finished local outputs and report precisely what remains unattached.

Return the proposal preview/link, editable diagram link, attachment outcome and
material open decisions. Proposal preparation does not authorize implementation,
PR changes, merging or deployment.
