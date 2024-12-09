import { Octokit } from "@octokit/rest";
import fs from "fs/promises";
import path from "path";

async function remindReviewers() {
  const token = process.env.GITHUB_TOKEN;
  const dryRun = process.env.DRY_RUN === "true";
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");

  const octokit = new Octokit({ auth: token });

  console.log(`Starting PR reviewer reminder for ${owner}/${repo}`);
  console.log(`Dry run mode: ${dryRun ? "Enabled" : "Disabled"}`);

  // Read user config from file
  const usersFile = path.join(process.env.GITHUB_ACTION_PATH, "users-config.json");
  const usersData = await fs.readFile(usersFile, "utf-8");
  const { ignored_users: ignoredUsers } = JSON.parse(usersData);
  const { always_tag_users: alwaysTagUsers } = JSON.parse(usersData);

  console.log(`Ignoring the following users: ${ignoredUsers.join(", ")}`);
  console.log(`Always tagging the following users: ${alwaysTagUsers.join(", ")}`);

  // Fetch all open pull requests
  const pulls = await octokit.rest.pulls.list({
    owner,
    repo,
    state: "open",
  });

  console.log(`Found ${pulls.data.length} open pull request(s).`);

  for (const pr of pulls.data) {
    console.log(`Processing PR #${pr.number}: ${pr.title}`);

    // Fetch pending reviewers
    const reviewRequests = await octokit.rest.pulls.listRequestedReviewers({
      owner,
      repo,
      pull_number: pr.number,
    });

    const pendingReviewers = reviewRequests.data.users
      .map((user) => `@${user.login}`)
      .filter((username) => !ignoredUsers.includes(username.replace("@", ""))); // Remove @ and check against ignored users

    console.log(
      `Pending reviewers for PR #${pr.number}: ${
        pendingReviewers.length ? pendingReviewers.join(", ") : "None"
      }`
    );

    // Add a comment if there are pending reviewers
    if (pendingReviewers.length > 0) {
      const commentBody = `🔔 Friendly reminder: The following reviewers still need to review this PR: ${pendingReviewers.join(
        ", "
      )}\n\nPS: ${alwaysTagUsers.join(", ")}`;

      if (!dryRun) {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: pr.number,
          body: commentBody,
        });
        console.log(`Added comment to PR #${pr.number}: "${commentBody}"`);
      } else {
        console.log(`[DRY RUN] Would add comment to PR #${pr.number}: "${commentBody}"`);
      }
    } else {
      console.log(`No pending reviewers for PR #${pr.number}. Skipping comment.`);
    }
  }

  console.log("Reminder process completed.");
}

remindReviewers().catch((error) => {
  console.error("Failed to send reminders:", error);
  process.exit(1);
});
