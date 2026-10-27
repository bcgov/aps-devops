"""Tests for the pure helpers in scripts/review_page.py (no git, gh or network needed).

Run: python3 -I -m unittest discover -s .agents/skills/release-pr-review/tests
"""
import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "review_page.py"
spec = importlib.util.spec_from_file_location("review_page", SCRIPT)
rp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rp)

VERSIONS_DIFF = """diff --git a/terraform/workspaces/gold/versions.tf b/terraform/workspaces/gold/versions.tf
index 1111111..2222222 100644
--- a/terraform/workspaces/gold/versions.tf
+++ b/terraform/workspaces/gold/versions.tf
@@ -3,9 +3,9 @@ locals {
     bcgov-aps-portal : "dev"
-    bcgov-csit-backstage : "sha-5ff387b"
+    bcgov-csit-backstage : "sha-3e3e6cd"
     bcgov-gwa-gateway-api : "dev"
     bcgov-gwa-kube-api : "dev"
     bcgov-gwa-scheduler : "dev"
     bcgov-healthapi : "1.0.0-7d47ed30"
-    bcgov-switchover : "v1.0.15"
+    bcgov-switchover : "v1.0.16"
     # external
diff --git a/archive/app-old.tf b/archive/app-old.tf
similarity index 100%
rename from terraform/app-old.tf
rename to archive/app-old.tf
diff --git a/dockerfiles/fixtures/data.mdb b/dockerfiles/fixtures/data.mdb
new file mode 100644
Binary files /dev/null and b/dockerfiles/fixtures/data.mdb differ
"""


class ParseDiff(unittest.TestCase):
    def test_files_hunks_renames_and_binaries(self):
        files = rp.parse_diff(VERSIONS_DIFF)
        self.assertEqual([f["path"] for f in files],
                         ["terraform/workspaces/gold/versions.tf", "archive/app-old.tf",
                          "dockerfiles/fixtures/data.mdb"])
        self.assertEqual(len(files[0]["hunks"]), 1)
        self.assertEqual(files[1]["old"], "terraform/app-old.tf")
        self.assertTrue(files[2]["binary"])
        self.assertEqual(rp.stats(files[:1]), (2, 2))


class FilterAndClaims(unittest.TestCase):
    def test_regex_keeps_matching_lines_with_context(self):
        claimed = set()
        files = rp.filter_hunks(rp.parse_diff(VERSIONS_DIFF), "bcgov-switchover", claimed)
        self.assertEqual(len(files), 1)
        lines = [l for h in files[0]["hunks"] for l in h["lines"]]
        self.assertIn('+    bcgov-switchover : "v1.0.16"', lines)
        self.assertNotIn('+    bcgov-csit-backstage : "sha-3e3e6cd"', lines)
        self.assertEqual(files[0]["hunks"][0]["header"], "@@ -7,4 +7,4 @@")
        path = "terraform/workspaces/gold/versions.tf"
        self.assertEqual(claimed, {(path, "-", 9), (path, "+", 9)})

    def test_no_regex_claims_everything_including_binaries(self):
        claimed = set()
        files = rp.filter_hunks(rp.parse_diff(VERSIONS_DIFF), None, claimed)
        self.assertEqual(len(files), 2)  # the pure rename has no hunks and isn't binary
        self.assertIn(("dockerfiles/fixtures/data.mdb", "binary", None), claimed)
        self.assertEqual(sum(1 for k in claimed if k[1] in "+-"), 4)

    def test_trim_splits_distant_changes(self):
        hunk = rp.parse_diff(VERSIONS_DIFF)[0]["hunks"][0]
        parts = rp.trim(hunk, lambda r: True, context=1)
        self.assertEqual([p["header"] for p in parts], ["@@ -3,3 +3,3 @@", "@@ -8,3 +8,3 @@"])


class ParseReview(unittest.TestCase):
    def test_block_fields(self):
        body = """
  title: Gateway DP tuning
  row: MISC: Gateway DP tuning
  files: charts/*/chart/values.yaml ~ failureThreshold
  files: terraform/modules/kong-dp/
  upstream: bcgov/gwa-api v1.0.51...v1.0.53 microservices/gatewayApi/
"""
        spec_ = rp.parse_review(body)
        self.assertEqual(spec_["title"], "Gateway DP tuning")
        self.assertEqual(spec_["row"], "MISC: Gateway DP tuning")
        self.assertEqual(spec_["files"], [("charts/*/chart/values.yaml", "failureThreshold"),
                                          ("terraform/modules/kong-dp/", None)])
        self.assertEqual(spec_["upstream"], [{"repo": "bcgov/gwa-api", "old": "v1.0.51", "new": "v1.0.53",
                                              "prefixes": ["microservices/gatewayApi/"]}])

    def test_indented_comment_in_list_item_is_found(self):
        md = "- **Item**\n  body\n  <!-- review\n  files: a.tf\n  -->\n\n  **Check:** x\n"
        m = rp.REVIEW_RE.search(md)
        self.assertIsNotNone(m)
        self.assertEqual(m.group(1), "  ")
        self.assertEqual(rp.parse_review(m.group(2))["files"], [("a.tf", None)])


class RowPlacement(unittest.TestCase):
    TABLE = ("<table><thead><tr><th>Item</th><th>Notes</th></tr></thead><tbody>"
             '<tr><td><a href="x">APS-4772</a> DevHub</td><td>dev only</td></tr>'
             "<tr><td>MISC: Gateway DP tuning (probes)</td><td>-</td></tr>"
             "</tbody></table>\n<p>REVIEWBLOCK0</p>\n<p>REVIEWBLOCK1</p>\n<p>REVIEWBLOCK2</p>")

    def specs(self):
        return [{"title": "APS-4772 DevHub image", "row": None},
                {"title": "Gateway DP tuning", "row": "MISC: Gateway DP tuning"},
                {"title": "Nowhere", "row": "MISC: Missing row"}]

    def test_blocks_land_under_their_rows(self):
        out, unplaced = rp.place_row_blocks(self.TABLE, self.specs(), ["<b>A</b>", "<b>B</b>", "<b>C</b>"])
        self.assertEqual(unplaced, ["MISC: Missing row"])
        self.assertIn('DevHub</td><td>dev only</td></tr><tr class="code-row"><td colspan="2"><b>A</b></td></tr>', out)
        self.assertIn('(probes)</td><td>-</td></tr><tr class="code-row"><td colspan="2"><b>B</b></td></tr>', out)
        self.assertNotIn("REVIEWBLOCK0", out)
        self.assertNotIn("REVIEWBLOCK1", out)
        self.assertIn("REVIEWBLOCK2", out)  # unmatched block stays where it was
        self.assertIn('class="table-scroll"', out)

    def test_row_key_falls_back_to_jira_key_in_title(self):
        self.assertEqual(rp.row_key({"title": "APS-4938 America/Vancouver", "row": None}), "APS-4938")
        self.assertIsNone(rp.row_key({"title": "Gateway DP tuning", "row": None}))


if __name__ == "__main__":
    unittest.main()
