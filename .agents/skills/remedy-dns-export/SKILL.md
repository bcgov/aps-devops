---
name: remedy-dns-export
description: Export Remedy NNR DNS records for the standard API/apps production, development and test domains or an explicitly requested domain through the signed-in browser to verified CSV and JSON snapshots under an infrastructure repository's root dns folder, and commit the exports when requested.
---

# Remedy DNS export

Example prompt: “Use remedy-dns-export to refresh all standard domains into api-serv-infra/dns and commit the snapshots.”

## Domain scope

For a standard/full export, or when no domain subset is specified, search and export each of these six domains separately:

- `api.gov.bc.ca`
- `dev.api.gov.bc.ca`
- `test.api.gov.bc.ca`
- `apps.gov.bc.ca`
- `dev.apps.gov.bc.ca`
- `test.apps.gov.bc.ca`

Honor an explicitly requested subset or additional domain. Each domain gets its own Quick Search and completeness check. Combine the three API domain captures into `dns/api.gov.bc.ca.csv` and `.json`, and the three apps captures into `dns/apps.gov.bc.ca.csv` and `.json`. Preserve each record's original Domain; do not relabel development/test records as production or deduplicate across domains. A parent-domain search does not replace searches for development/test domains. Keep exact-domain filtering for every search. Report completion, count and any failure per domain; do not claim a full refresh if one domain could not be exported. If any family member fails verification, retain the prior combined family snapshot and report the incomplete family. An explicit subset can be exported to a temporary destination for inspection, but must not overwrite a combined family snapshot.

Resolve the infrastructure repository from the prompt or established conversation; `api-serv-infra` and `aps-infra-platform` are different repositories. Confirm the destination if ambiguous. Inspect its repository instructions and Git state. Use an isolated worktree for changes when the shared checkout contains unrelated work. Never switch a shared checkout. The skill is stored in aps-devops `.agents/skills` for repository discovery; from another workspace, explicitly reference this SKILL.md if it is not in the available skill catalog.

## Browser extraction

Use the supported browser tools and their current documentation. Reuse the user's signed-in Remedy tab when available; otherwise open:

https://pobcapps.ca.onbmc.com/arsys/forms/onbmc-s/NNR%3A+Menu+-+VERSION+2/Default+Administrator+View/

If organizational sign-in is required, leave the tab available and ask the user to sign in; resume after they confirm. Never store credentials, cookies, authentication URLs or session data in exports.

1. Select DNS in the NNR menu. A blank Search DNS plus Enter opens `NNR:dlg DNS Search and Edit` in another tab. Discover that tab rather than guessing another endpoint.
2. Fill **Quick Search** with the requested domain and press Enter. Verify the generated query and result count have changed to the requested search. Clicking Search immediately after a fill may initially leave the previous query visible.
3. Quick Search matches hostname/domain/data prefixes, not exact domain membership. Capture the displayed “N of M results” and the loaded table. Export only rows whose Domain exactly equals the requested domain (case-insensitive, ignoring one trailing dot). Report excluded rows. Do not silently widen to other zones or suffix matches.
4. Inspect the current DOM. In the observed v2.0.54 UI the results table is `T536870913`, but confirm it from the page each time. The table contains a header plus data rows. Read each row's cells in column order, taking the `value` of an input/textarea when present, otherwise visible text. Keep blank cells: accessible text alone can omit empty Port/Priority/Weight/PTR fields.
5. Require all reported results to be loaded before saving. If N differs from M, follow visible pagination/loading controls and capture every page without duplication; if that cannot be verified, stop and report an incomplete export. A Report link exists but did not produce an export in the observed session; do not confuse Save/Save As with file export.
6. Save the exact captured array (including header) to temporary JSON using available file tools, without reconstructing default values or deduplicating names. Preserve apex `@`, wildcard `*`, underscores, TXT values, multiple-address records, status, view and admin group. The helper omits the final user audit columns in output, matching the established CSV/JSON exports.

Read-only DOM example after inspecting the table and verifying its selector:

```js
const rows = await tab.playwright.locator('#T536870913').evaluate(table =>
  Array.from(table.rows).map(row => Array.from(row.cells).map(cell => {
    const input = cell.querySelector('input,textarea');
    return input ? input.value : cell.innerText.trim();
  })));
```

Use only browser APIs available in the active environment. Never access hidden application state, issue guessed API requests, or extract session tokens. Record retrieval and local export do not authorize Add, Bulk Add, Update, Save, Save As, Delete or permission changes. This form edits production data.

## Validate, save and commit

For each family, save a temporary JSON array containing three objects, each with `domain`, `expected_total` (the displayed result total), and `rows` (the exact captured table array including its header). Run the helper only after all three searches are verified:

```sh
python3 <skill-directory>/scripts/export_dns.py --captures <api-captures.json> \
  --domain api.gov.bc.ca --repo <infra-repo>
python3 <skill-directory>/scripts/export_dns.py --captures <apps-captures.json> \
  --domain apps.gov.bc.ca --repo <infra-repo>
```

The helper validates all three captures before writing a family pair. JSON includes the three domain names, per-search counts and a combined record count. CSV retains the Domain column. Do not create separate dev/test export files for the standard workflow.

The total is evidence from this run, not a hard-coded expected number. For an empty result, verify the page reports zero and capture the header. Snapshots describe Remedy inventory, not authoritative live DNS resolution. The strict new-record validator in `remedy-dns/remedy_dns.py` has a different schema and must not validate or filter lossless snapshots.

Read the generated files back, inspect the scoped diff and summarize count/type totals and exclusions. Check changed records before replacing a previous snapshot, preserving existing files if validation fails. Stage only the requested `dns/<domain>.csv` and `.json` paths. If the request says check in/commit, commit them on the isolated branch; do not push, create a PR, merge or deploy unless requested. Return file links, repository, branch and commit. Keep sign-in tabs available when needed for another domain.
