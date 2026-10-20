# Editing the D2 proposal view

Files relative to this skill folder:

- `assets/architecture-template.d2`: edit the reusable diagram's components,
  relationships and direction. This is a neutral logical view.
- `assets/master-components.json`: master inventory with stable `id`, display
  `label`, `repository`, repository-relative `path` and `purpose`. It is a starter
  inventory, not an exhaustive or approved deployment architecture. Some entries
  are logical boundaries in the same process. Confirm external ownership.
- `assets/APS-4927-changes.json`: worked example of ticket-specific change input.
  Copy it for another ticket; change ticket/title and replace the changes array.

Use IDs from the master inventory for diagram nodes and change rows. Preserve IDs
when renaming components; edit master labels for generated highlighted labels.
An inventory entry does not automatically appear in the diagram. Add a top-level
node to the template to include it, for example:

```d2
edge_image: SDX Edge image {class: context}
edge_chart: SDX Edge chart {class: context}
edge_image -> edge_chart: Image digest
```

D2 uses automatic layout rather than drag coordinates. Edit `direction: right`
to `direction: down` or revise connections to change the arrangement. The current
helper supports top-level component IDs; don't nest them in containers because
that changes their D2 paths. Separate templates can show different architecture
views using the same inventory. Keep proposal views small enough for one-third
of an A4 page; the full master list need not fit into every proposal.

Each change row needs `id`, `kind`, `summary` and `validation`. Allowed kinds are
`modify`, `add`, `remove`, `uncertain`. For additions, use an existing master identity; ask the user to update the
master if a genuinely new component is needed. Never copy/expand the master just
to turn a ticket-specific implementation area into a component. Components absent from changes remain neutral
context. For a removed component, retain its node with `kind: remove`.

From the skill folder:

```sh
python3 scripts/prepare_diagram.py \
  --template assets/architecture-template.d2 \
  --components assets/master-components.json \
  --changes assets/APS-4927-changes.json \
  --output /tmp/APS-4927-proposal.d2

d2 /tmp/APS-4927-proposal.d2 /tmp/APS-4927-proposal.svg
```

The helper preserves the template and appends styles/labels to a separate output.
It also emits `/tmp/APS-4927-proposal.summary.json`, enriched with repository/path
metadata from the master list. Use those rows for the proposal's bottom summary.
No second manually maintained list of highlighted components is needed. The
output is self-contained D2 source, suitable for attachment without its inputs.

Install a supported D2 CLI from the official D2 distribution if unavailable.
The template and example were compiled with D2 0.7.1. SVG is the preferred diagram
export for PDF composition. Inspect the final PDF for labels, clipping and scale.
Official references: https://d2lang.com/tour/classes/ and
https://d2lang.com/tour/exports/ .

## Component identity versus subcomponents

The master list is authoritative. A change like Subsystem / CSS association is an
implementation area of `portal`, not a new component. Use `subcomponent` for it:

```json
{"id":"portal","kind":"modify","subcomponent":"Subsystem / CSS association","summary":"Enforce the mapping invariant.","validation":"Test conflicting writes."}
```

Summary layout: left column contains repository and master component label only.
Right column uses `<subcomponent>: <changes>` from generated `proposed_change`.
Describe intended behavior/outcomes; reserve implementation procedures for the
validation and rollout notes.
Diagram nodes retain master labels only. Combine multiple areas of one parent in
one change row. Component label, repository, path and purpose cannot be overridden
by change input. All declared diagram nodes must resolve to master IDs.

If no listed component fits repository-owned work, use a repository-only row:

```json
{"repository":"api-serv-infra","kind":"modify","subcomponent":"PostgreSQL migration / cutover","summary":"Audit and apply constraints.","validation":"Reject invalid mappings."}
```

Its template node is `repo_api_serv_infra: api-serv-infra {class: context}`.
Repository names must already occur in the master list. This records a repository
work area without inventing a component; request a master-list change separately
if a new component identity is needed. Repository-only rows show the repository
once on the left and the subcomponent prefix in the proposed-change column. Never promote subcomponent text into nodes.
