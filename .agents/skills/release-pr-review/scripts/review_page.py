#!/usr/bin/env python3
"""Build a single-file HTML code-review page for an api-serv-infra promotion PR.

The page is the PR description (rendered by GitHub's own Markdown API) with each
reviewed item expanded to show the code behind it. Items opt in with a hidden
comment in the PR description, placed inside the list item:

    <!-- review
    files: terraform/workspaces/gold/versions.tf ~ bcgov-switchover
    files: terraform/modules/sdx/
    upstream: bcgov/switchover-agent v1.0.15...v1.0.16 src/
    -->

  title:     optional label for the code panel.
  row:       for LOW rows: the text the table row's first cell starts with (e.g.
             "APS-4772" or "MISC: Gateway DP tuning"). Put these blocks after the
             table; the page shows each panel in a full-width row under its row.
             Without row:, a title starting with a Jira key is used.
  files:     a path, directory or glob (git pathspec). "~ <regex>" keeps only the
             changed lines that match (plus 2 lines of context), which suits shared
             files like versions.tf.
  upstream:  owner/repo old...new [path-prefix ...]. Shown as links only: the tag
             compare on GitHub and the upstream PRs named in its commit subjects.
             The path prefixes only scope the "files changed" count.

Every changed hunk that no item claims is listed at the end under
"Not covered by any item", which doubles as a coverage check for the review.

Needs only python3, git and an authenticated gh. Run it from a clone of the repo:

    python3 review_page.py 377 -o pr377-review.html
    python3 review_page.py 377 --fragment -o page.html   # body-only, for hosts that add <html>/<head>
"""
import argparse
import datetime
import html
import json
import os
import re
import subprocess
import sys
import tempfile

MAX_LINES_PER_FILE = 400
REVIEW_RE = re.compile(r"^([ \t]*)<!--\s*review\b(.*?)-->[ \t]*$", re.S | re.M)


def run(*args, ok_codes=(0,)):
    p = subprocess.run(args, capture_output=True, text=True)
    if p.returncode not in ok_codes:
        sys.exit(f"command failed ({p.returncode}): {' '.join(args)}\n{p.stderr.strip()}")
    return p.stdout, p.returncode


def gh_json(*args):
    out, _ = run("gh", *args)
    return json.loads(out)


# ---------- diff parsing ----------

def parse_diff(text):
    """Return [{path, old, new, binary, hunks:[{header, lines}]}] from unified diff text."""
    files, cur, hunk = [], None, None
    for line in text.splitlines():
        if line.startswith("diff --git "):
            m = re.match(r"diff --git a/(.*) b/(.*)", line)
            cur = {"path": m.group(2) if m else line[11:], "old": None, "binary": False, "hunks": []}
            files.append(cur)
            hunk = None
        elif cur is None:
            continue
        elif line.startswith("rename from "):
            cur["old"] = line[12:]
        elif line.startswith("Binary files "):
            cur["binary"] = True
        elif line.startswith("@@"):
            hunk = {"header": line, "lines": []}
            cur["hunks"].append(hunk)
        elif hunk is not None and line[:1] in ("+", "-", " ", "\\"):
            if line.startswith(("+++ ", "--- ")) and not hunk["lines"]:
                continue
            hunk["lines"].append(line)
    return files


def numbered(h):
    """Yield (raw_line, old_no, new_no) for a hunk; numbers are None where a side has no line."""
    m = re.match(r"@@ -(\d+)(?:,\d+)? \+(\d+)", h["header"])
    o, n = (int(m.group(1)), int(m.group(2))) if m else (0, 0)
    out = []
    for l in h["lines"]:
        k = l[:1]
        if k == "+":
            out.append((l, None, n)); n += 1
        elif k == "-":
            out.append((l, o, None)); o += 1
        elif k == "\\":
            out.append((l, None, None))
        else:
            out.append((l, o, n)); o += 1; n += 1
    return out


def line_key(path, row):
    raw, o, n = row
    return (path, "-", o) if raw.startswith("-") else (path, "+", n)


def trim(h, keep, context=2):
    """Cut a hunk down to the changed lines where keep(row) is true, plus a little context."""
    rows = numbered(h)
    marks = [i for i, r in enumerate(rows) if r[0][:1] in "+-" and keep(r)]
    if not marks:
        return []
    window = sorted({j for i in marks for j in range(max(0, i - context), min(len(rows), i + context + 1))})
    groups, cur = [], [window[0]]
    for j in window[1:]:
        if j == cur[-1] + 1:
            cur.append(j)
        else:
            groups.append(cur); cur = [j]
    groups.append(cur)
    out = []
    for g in groups:
        seg = [rows[j] for j in g]
        os_ = next((r[1] for r in seg if r[1] is not None), 0)
        ns_ = next((r[2] for r in seg if r[2] is not None), 0)
        oc = sum(1 for r in seg if r[1] is not None)
        nc = sum(1 for r in seg if r[2] is not None)
        out.append({"header": f"@@ -{os_},{oc} +{ns_},{nc} @@", "lines": [r[0] for r in seg]})
    return out


def filter_hunks(files, regex, claimed=None):
    """Keep the changes matching regex (all changes when regex is None); record them in claimed."""
    rx = re.compile(regex) if regex else None
    out = []
    for f in files:
        match = (lambda r: True) if rx is None else (lambda r: bool(rx.search(r[0][1:])))
        hunks = f["hunks"] if rx is None else [s for h in f["hunks"] for s in trim(h, match)]
        if claimed is not None:
            for h in f["hunks"]:
                for r in numbered(h):
                    if r[0][:1] in "+-" and match(r):
                        claimed.add(line_key(f["path"], r))
            if rx is None and f["binary"]:
                claimed.add((f["path"], "binary", None))
        if hunks or (rx is None and f["binary"]):
            out.append({**f, "hunks": hunks})
    return out


def stats(files):
    add = sum(1 for f in files for h in f["hunks"] for l in h["lines"] if l.startswith("+"))
    rem = sum(1 for f in files for h in f["hunks"] for l in h["lines"] if l.startswith("-"))
    return add, rem


# ---------- review blocks ----------

def parse_review(body):
    spec = {"title": None, "row": None, "files": [], "upstream": []}
    for raw in body.splitlines():
        line = raw.strip()
        if line.startswith("title:"):
            spec["title"] = line[6:].strip()
        elif line.startswith("row:"):
            spec["row"] = line[4:].strip()
        elif line.startswith("files:"):
            path, _, rx = line[6:].partition("~")
            spec["files"].append((path.strip(), rx.strip() or None))
        elif line.startswith("upstream:"):
            parts = line[9:].split()
            if len(parts) >= 2 and "..." in parts[1]:
                old, new = parts[1].split("...", 1)
                spec["upstream"].append({"repo": parts[0], "old": old, "new": new, "prefixes": parts[2:]})
    return spec


class Ctx:
    def __init__(self, pr, repo):
        self.pr, self.repo = pr, repo
        self.url = pr["url"]
        self.notes = []
        if pr["state"] == "MERGED":
            self.base, self.result = pr["baseRefOid"], pr["mergeCommit"]["oid"]
            self.range = f'{pr["baseRefOid"]}..{pr["headRefOid"]}'
            self.head_ref = pr["headRefOid"]
        else:
            b, h = f'origin/{pr["baseRefName"]}', f'origin/{pr["headRefName"]}'
            run("git", "fetch", "-q", "origin", pr["baseRefName"], pr["headRefName"])
            out, code = run("git", "merge-tree", "--write-tree", b, h, ok_codes=(0, 1))
            self.base, self.result = b, out.splitlines()[0]
            self.range, self.head_ref = f"{b}..{h}", h
            if code == 1:
                self.notes.append("The branches have merge conflicts, so the net change includes "
                                  "conflict markers where they disagree. Resolve them for a clean view.")

    def net(self, path, rx=None, claimed=None):
        out, _ = run("git", "diff", "-M", self.base, self.result, "--", path)
        return filter_hunks(parse_diff(out), rx, claimed)

    def commits(self, path, rx=None):
        args = ["git", "log", "--no-merges", "--format=%H%x1f%an%x1f%ad%x1f%ct%x1f%s", "--date=short", self.range]
        if rx:
            args.append(f"-G{rx}")
        out, _ = run(*args, "--", path)
        return [dict(zip(("sha", "author", "date", "ts", "subject"), l.split("\x1f"))) for l in out.splitlines() if l]

    def commit_diff(self, sha, path, rx=None):
        out, _ = run("git", "show", "-M", "--format=", sha, "--", path)
        return filter_hunks(parse_diff(out), rx)


def upstream_summary(u):
    """Links only: the tag compare plus the PRs named in its commit subjects. No file diffs."""
    url = f'https://github.com/{u["repo"]}/compare/{u["old"]}...{u["new"]}'
    p = subprocess.run(["gh", "api", f'repos/{u["repo"]}/compare/{u["old"]}...{u["new"]}',
                        "--jq", '{n: .total_commits, files: [.files[].filename], msgs: [.commits[].commit.message]}'],
                       capture_output=True, text=True)
    if p.returncode != 0:
        return url, None, [], 0
    data = json.loads(p.stdout)
    prs, seen = [], set()
    for msg in data["msgs"]:
        first = msg.splitlines()[0]
        m = re.match(r"Merge pull request #(\d+)", first)
        title = msg.splitlines()[2] if m and len(msg.splitlines()) > 2 else first
        num = m.group(1) if m else (re.findall(r"\(#(\d+)\)", first) or [None])[-1]
        if num and num not in seen:
            seen.add(num)
            prs.append((num, re.sub(r"\s*\(#\d+\)$", "", title)))
    files = [f for f in data["files"] if not u["prefixes"] or any(f.startswith(x) for x in u["prefixes"])]
    return url, data["n"], prs, len(files)


# ---------- rendering ----------

def esc(s):
    return html.escape(s, quote=True)


def render_files(files, link_base=None):
    out = []
    for f in files:
        add, rem = stats([f])
        name = esc(f["path"]) if not f["old"] else f'{esc(f["old"])} → {esc(f["path"])}'
        link = f' <a class="ext" href="{esc(link_base + f["path"])}">view file</a>' if link_base else ""
        out.append(f'<div class="file"><div class="file-head"><span class="path">{name}</span>'
                   f'<span class="delta"><span class="plus">+{add}</span> <span class="minus">−{rem}</span></span>{link}</div>')
        if f["binary"] or not f["hunks"]:
            out.append('<div class="note">Binary file or no text diff available.</div></div>')
            continue
        rows, shown, total = [], 0, sum(len(h["lines"]) for h in f["hunks"])
        for h in f["hunks"]:
            m = re.match(r"@@ -(\d+)(?:,\d+)? \+(\d+)", h["header"])
            o, n = (int(m.group(1)), int(m.group(2))) if m else (0, 0)
            rows.append(f'<tr class="hunk"><td></td><td></td><td>{esc(h["header"])}</td></tr>')
            for l in h["lines"]:
                if shown >= MAX_LINES_PER_FILE:
                    break
                kind, text = l[:1], esc(l[1:])
                if kind == "+":
                    rows.append(f'<tr class="add"><td></td><td>{n}</td><td>+{text}</td></tr>'); n += 1
                elif kind == "-":
                    rows.append(f'<tr class="del"><td>{o}</td><td></td><td>−{text}</td></tr>'); o += 1
                elif kind == "\\":
                    rows.append(f'<tr class="ctx"><td></td><td></td><td>{text}</td></tr>')
                else:
                    rows.append(f'<tr class="ctx"><td>{o}</td><td>{n}</td><td> {text}</td></tr>'); o += 1; n += 1
                shown += 1
        more = f'<div class="note">{total - shown} more lines not shown.</div>' if shown < total else ""
        out.append(f'<div class="scroll"><table class="diff">{"".join(rows)}</table></div>{more}</div>')
    return "".join(out)


def commit_link(ctx, sha):
    return f'https://github.com/{ctx.repo}/commit/{sha}'


def render_block(ctx, spec, claimed):
    net_files, commits, per_commit = [], {}, {}
    for path, rx in spec["files"]:
        net_files.extend(ctx.net(path, rx, claimed))
        for c in ctx.commits(path, rx):
            commits.setdefault(c["sha"], c)
            per_commit.setdefault(c["sha"], []).extend(ctx.commit_diff(c["sha"], path, rx))

    blob = f'https://github.com/{ctx.repo}/blob/{ctx.result if ctx.pr["state"] == "MERGED" else ctx.pr["headRefName"]}/'
    add, rem = stats(net_files)
    parts = []
    if net_files:
        parts.append(f'<section class="pane"><h4>Net change in this PR</h4>{render_files(net_files, blob)}</section>')
    if commits:
        items = []
        for sha, c in sorted(commits.items(), key=lambda kv: int(kv[1]["ts"])):
            a, r = stats(per_commit[sha])
            items.append(f'<details class="commit"><summary><code>{sha[:8]}</code> {esc(c["subject"])} '
                         f'<span class="meta">{esc(c["author"])} · {c["date"]} · +{a} −{r}</span></summary>'
                         f'<a class="ext" href="{commit_link(ctx, sha)}">Open commit on GitHub</a>'
                         f'{render_files(per_commit[sha])}</details>')
        parts.append(f'<section class="pane"><h4>Commits that touched this ({len(commits)})</h4>{"".join(items)}</section>')
    if spec["upstream"]:
        rows = []
        for u in spec["upstream"]:
            url, ncommits, prs, nfiles = upstream_summary(u)
            scope = f' in {", ".join(f"<code>{esc(x)}</code>" for x in u["prefixes"])}' if u["prefixes"] else ""
            facts = (f'{ncommits} commit{"s" if ncommits != 1 else ""}, {nfiles} file{"s" if nfiles != 1 else ""} changed{scope}'
                     if ncommits is not None else "couldn't read the compare (check the tags)")
            pr_links = "".join(f'<li><a href="https://github.com/{esc(u["repo"])}/pull/{n}">#{n}</a> {esc(t)}</li>'
                               for n, t in prs)
            rows.append(f'<li><a href="{esc(url)}"><strong>{esc(u["repo"])}</strong> '
                        f'<code>{esc(u["old"])}</code> → <code>{esc(u["new"])}</code></a> '
                        f'<span class="meta">{facts}</span>'
                        f'{f"<ul>{pr_links}</ul>" if pr_links else ""}</li>')
        parts.append(f'<section class="pane"><h4>Upstream changes</h4><ul class="clist">{"".join(rows)}</ul></section>')

    nfiles = len({f["path"] for f in net_files})
    bits = [f"{nfiles} file{'s' if nfiles != 1 else ''}"] if nfiles else []
    if commits:
        bits.append(f"{len(commits)} commit{'s' if len(commits) != 1 else ''}")
    if spec["upstream"]:
        bits.append("upstream")
    title = f'<strong>{esc(spec["title"])}</strong> ' if spec["title"] else ""
    summary = (f'<summary><span class="label">Code</span> {title}{" · ".join(bits)} '
               f'<span class="delta"><span class="plus">+{add}</span> <span class="minus">−{rem}</span></span></summary>')
    return f'<details class="code">{summary}{"".join(parts)}</details>'


def render_uncovered(ctx, claimed):
    out, _ = run("git", "diff", "-M", ctx.base, ctx.result)
    left = []
    for f in parse_diff(out):
        # Lines with no letters or digits (blank lines, lone braces) don't need an owner.
        unclaimed = lambda r, p=f["path"]: line_key(p, r) not in claimed and bool(re.search(r"\w", r[0][1:]))
        hunks = [s for h in f["hunks"] for s in trim(h, unclaimed)]
        if hunks or (f["binary"] and (f["path"], "binary", None) not in claimed):
            left.append({**f, "hunks": hunks})
    if not left:
        return '<p class="muted">Every changed hunk is covered by an item above.</p>'
    rows = []
    for f in left:
        a, r = stats([f])
        rows.append(f'<details class="commit"><summary><span class="path">{esc(f["path"])}</span> '
                    f'<span class="delta"><span class="plus">+{a}</span> <span class="minus">−{r}</span></span></summary>'
                    f'{render_files([f])}</details>')
    return (f'<p class="muted">{len(left)} file{"s" if len(left) != 1 else ""} with changes that no item claims. '
            f'Each one is either covered by a LOW row in the description or still needs a mapping.</p>{"".join(rows)}')


def row_key(spec):
    """The text a table row's first cell starts with: row:, else a leading Jira key in title:."""
    if spec["row"]:
        return spec["row"]
    m = re.match(r"(APS-\d+)\b", spec["title"] or "")
    return m.group(1) if m else None


def cell_text(cell_html):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", cell_html))).strip()


def place_row_blocks(rendered, specs, blocks):
    """Move blocks that name a table row into a full-width row right under it.

    Returns the new HTML and the row keys that matched nothing (those blocks stay put)."""
    wanted = {i: row_key(s) for i, s in enumerate(specs) if row_key(s)}
    placed = set()

    def fix_table(m):
        table, hit = m.group(0), False

        def fix_row(r):
            nonlocal hit
            cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r.group(0), re.S)
            if not cells or "<th" in r.group(0):
                return r.group(0)
            first = cell_text(cells[0])
            extra = ""
            for i, key in wanted.items():
                if i not in placed and first.startswith(key):
                    placed.add(i)
                    hit = True
                    extra += f'<tr class="code-row"><td colspan="{len(cells)}">{blocks[i]}</td></tr>'
            return r.group(0) + extra

        table = re.sub(r"<tr\b.*?</tr>", fix_row, table, flags=re.S)
        if hit:
            table = '<div class="table-scroll">' + table.replace("<table", '<table class="has-code"', 1) + "</div>"
        return table

    rendered = re.sub(r"<table\b.*?</table>", fix_table, rendered, flags=re.S)
    for i in placed:  # drop the placeholder of every block that found its row
        rendered = re.sub(rf"<p>\s*REVIEWBLOCK{i}\s*</p>|REVIEWBLOCK{i}(?!\d)", "", rendered)
    return rendered, [k for i, k in wanted.items() if i not in placed]


CSS = """
/* Layout: one reading column; code panes widen to the full column and scroll on their own. */
:root{
  --bg:#f7f8fa; --surface:#ffffff; --fg:#1d2330; --muted:#5b6475; --line:#dde1e8;
  --accent:#2f5bd3; --add-bg:#e6f4ea; --add-fg:#1c6b34; --del-bg:#fbe9e9; --del-fg:#a12828;
  --hunk-bg:#eef1f8; --code-bg:#f1f3f7;
  --font-body:"IBM Plex Sans",-apple-system,"Segoe UI",Roboto,sans-serif;
  --font-mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#12151b; --surface:#191d25; --fg:#e3e7ef; --muted:#9aa3b5; --line:#2b313d;
  --accent:#86a6ff; --add-bg:#16301f; --add-fg:#7fd99a; --del-bg:#3a1c1e; --del-fg:#ff9b9b;
  --hunk-bg:#1f2633; --code-bg:#1f2430; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#12151b; --surface:#191d25; --fg:#e3e7ef; --muted:#9aa3b5; --line:#2b313d;
  --accent:#86a6ff; --add-bg:#16301f; --add-fg:#7fd99a; --del-bg:#3a1c1e; --del-fg:#ff9b9b;
  --hunk-bg:#1f2633; --code-bg:#1f2430; color-scheme:dark}
body{background:var(--bg);color:var(--fg);font:15px/1.55 var(--font-body)}
.wrap{max-width:1040px;margin:0 auto;padding-block:28px 64px;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
a{color:var(--accent)} a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
header.pr{display:grid;gap:6px;padding-bottom:18px;border-bottom:1px solid var(--line);margin-bottom:8px}
header.pr .eyebrow{font:500 12px/1 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
header.pr h1{font-size:1.6rem;line-height:1.25;margin:0;text-wrap:balance}
header.pr .facts{display:flex;flex-wrap:wrap;gap:6px 18px;color:var(--muted);font-size:13px}
header.pr .facts code{font-family:var(--font-mono)}
.banner{background:var(--hunk-bg);border-radius:6px;padding:10px 14px;margin:12px 0;font-size:14px}
.desc h2{font-size:1.2rem;margin:34px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.desc p,.desc li{max-width:72ch}
.desc li{margin-block:4px}
.desc>ul>li{margin-block:18px}
.desc code{font:13px var(--font-mono);background:var(--code-bg);padding:1px 5px;border-radius:4px}
.desc table{border-collapse:collapse;font-size:14px;display:block;overflow-x:auto}
.desc th,.desc td{border:1px solid var(--line);padding:6px 10px;text-align:left;vertical-align:top}
.table-scroll{overflow-x:auto}
.desc table.has-code{display:table;table-layout:fixed;width:100%;min-width:720px}
.desc table.has-code th:nth-child(1){width:30%} .desc table.has-code th:nth-child(5){width:28%}
.desc tr.code-row>td{padding:0 8px 6px;border-top:0;background:var(--bg)}
.desc tr.code-row details.code{margin:4px 0}
.desc .task-list-item{list-style:none}
.desc .contains-task-list{padding-left:20px}
.desc input[type=checkbox]{margin-right:6px}
details.code{margin:12px 0 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface);max-width:none}
details.code>summary{cursor:pointer;padding:8px 12px;font-size:14px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline}
details.code>summary .label{font:600 11px/1 var(--font-mono);letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
details.code[open]>summary{border-bottom:1px solid var(--line)}
.pane{padding:10px 12px 4px}
.pane h4{margin:6px 0 8px;font-size:13px;color:var(--muted);font-weight:600}
.file{border:1px solid var(--line);border-radius:6px;margin:8px 0 12px;overflow:hidden;background:var(--surface)}
.file-head{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;padding:6px 10px;background:var(--code-bg);font-size:13px}
.path{font-family:var(--font-mono);word-break:break-all;min-width:0}
.delta{font:12px var(--font-mono);font-variant-numeric:tabular-nums}
.plus{color:var(--add-fg)} .minus{color:var(--del-fg)}
.ext{font-size:12px}
.scroll{overflow-x:auto}
table.diff{border-collapse:collapse;width:100%;font:12.5px/1.5 var(--font-mono)}
table.diff td{padding:0 8px;white-space:pre;vertical-align:top}
table.diff td:nth-child(-n+2){width:1%;color:var(--muted);text-align:right;user-select:none;font-variant-numeric:tabular-nums}
tr.add td{background:var(--add-bg)} tr.add td:last-child{color:var(--add-fg)}
tr.del td{background:var(--del-bg)} tr.del td:last-child{color:var(--del-fg)}
tr.hunk td{background:var(--hunk-bg);color:var(--muted)}
.note,.muted{color:var(--muted);font-size:13px}
.note{padding:6px 10px}
details.commit{border-top:1px solid var(--line);padding:6px 0}
details.commit>summary{cursor:pointer;font-size:14px}
details.commit .meta,.clist .meta{color:var(--muted);font-size:12px}
.clist{padding-left:18px;font-size:14px}
footer{margin-top:40px;color:var(--muted);font-size:13px}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pr", help="PR number")
    ap.add_argument("--repo", default="bcgov-c/api-serv-infra")
    ap.add_argument("--body-file", help="use this Markdown instead of the live PR description (for previews)")
    ap.add_argument("--fragment", action="store_true", help="omit <!doctype>/<html>/<head>/<body>")
    ap.add_argument("-o", "--output", default="-")
    args = ap.parse_args()

    pr = gh_json("pr", "view", args.pr, "--repo", args.repo, "--json",
                 "number,title,url,state,body,baseRefName,headRefName,baseRefOid,headRefOid,mergeCommit")
    body = open(args.body_file).read() if args.body_file else pr["body"]
    ctx = Ctx(pr, args.repo)

    specs = []

    def to_token(m):
        specs.append(parse_review(m.group(2)))
        return f"\n{m.group(1)}REVIEWBLOCK{len(specs) - 1}\n"

    md = REVIEW_RE.sub(to_token, body)
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as t:
        t.write(md)
    rendered, _ = run("gh", "api", "markdown", "-f", "mode=gfm", "-f", f"context={args.repo}", "-F", f"text=@{t.name}")

    claimed = set()
    blocks = [render_block(ctx, s, claimed) for s in specs]
    rendered, unplaced = place_row_blocks(rendered, specs, blocks)
    rendered = re.sub(r"<p>\s*REVIEWBLOCK(\d+)\s*</p>|REVIEWBLOCK(\d+)",
                      lambda m: blocks[int(m.group(1) or m.group(2))], rendered)
    uncovered = render_uncovered(ctx, claimed)

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    ctx.notes += [f'No table row starts with "{k}", so its code panel stays where its block is.' for k in unplaced]
    notes = "".join(f'<div class="banner">{esc(n)}</div>' for n in ctx.notes)
    if not specs:
        notes += ('<div class="banner">No item in this description has a <code>&lt;!-- review --&gt;</code> mapping yet, '
                  'so every change is listed at the end.</div>')
    head = (f'<title>PR {pr["number"]} code review</title>\n'
            '<meta name="claude:viewport-fit-sides" content="cover">\n'
            '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600'
            '&family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap">\n'
            f"<style>{CSS}</style>\n")
    page = (f'<div class="wrap"><header class="pr"><span class="eyebrow">{esc(args.repo)} · PR {pr["number"]} · {pr["state"].lower()}</span>'
            f'<h1>{esc(pr["title"])}</h1><div class="facts">'
            f'<span><code>{esc(pr["headRefName"])}</code> → <code>{esc(pr["baseRefName"])}</code></span>'
            f'<span>Generated {now} from the description as it was then</span>'
            f'<a href="{esc(pr["url"])}">Open the PR to tick TEST/PROD boxes</a></div></header>{notes}'
            f'<main class="desc">{rendered}<h2>Not covered by any item</h2>{uncovered}</main>'
            f'<footer>Built by <code>release-pr-review/scripts/review_page.py</code>. Rerun it after the description changes.</footer></div>')
    doc = head + page if args.fragment else \
        f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n{head}</head><body>{page}</body></html>\n'
    if args.output == "-":
        sys.stdout.write(doc)
    else:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w") as fh:
            fh.write(doc)
        print(f"wrote {args.output} ({len(doc) // 1024} KB, {len(specs)} mapped item(s))", file=sys.stderr)


if __name__ == "__main__":
    main()
