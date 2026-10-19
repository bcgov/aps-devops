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
`modify`, `add`, `remove`, `uncertain`. For additions, first create a master entry
and place its node in the template. Components absent from changes remain neutral
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
