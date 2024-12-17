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
  console.log(`Token passed: ${process.env.GITHUB_TOKEN ? 'REDACTED' : 'NOT FOUND'}`);

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

    // Skip PRs that already have the 'reminded' label
    const labels = await octokit.rest.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: pr.number,
    });

    if (labels.data.some((label) => label.name === "reminded")) {
      console.log(`PR #${pr.number} already has 'reminded' label. Skipping.`);
      continue;
    }

    // Check PR age
    const prCreatedAt = new Date(pr.created_at);
    const now = new Date();
    const hoursSinceOpened = Math.abs(now - prCreatedAt) / 36e5;

    if (hoursSinceOpened < 48) {
      console.log(`PR #${pr.number} is ${hoursSinceOpened.toFixed(1)} hours old. Skipping reminder.`);
      continue;
    }

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
      )}\n\nPS: ${alwaysTagUsers.map(user => `@${user}`).join(", ")}`;

      if (!dryRun) {
        // Add the comment
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: pr.number,
          body: commentBody,
        });
        console.log(`Added comment to PR #${pr.number}: "${commentBody}"`);

        // Add the 'reminded' label
        await octokit.rest.issues.addLabels({
          owner,
          repo,
          issue_number: pr.number,
          labels: ["reminded"],
        });
        console.log(`Added 'reminded' label to PR #${pr.number}`);
      } else {
        console.log(`[DRY RUN] Would add comment to PR #${pr.number}: "${commentBody}"`);
        console.log(`[DRY RUN] Would add 'reminded' label to PR #${pr.number}`);
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
