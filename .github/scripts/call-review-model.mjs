#!/usr/bin/env node
// Calls one reviewer model (GPT, Grok, or Claude) with the shared
// review-response-format skill as its system prompt, so all three reviewers
// return findings in the same shape. Used by .github/workflows/pr-multi-review.yml.

import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    if (!key) continue;
    out[key] = argv[i + 1];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const provider = args.provider;
if (!["gpt", "grok", "claude"].includes(provider)) {
  console.error(
    `--provider must be one of gpt|grok|claude, got: ${provider}`,
  );
  process.exit(1);
}

const MAX_DIFF_CHARS = 150_000;

const skillRaw = readFileSync(args["skill-file"], "utf8");
// Strip the YAML frontmatter, keep the instructions body.
const instructions = skillRaw
  .replace(/^---\n[\s\S]*?\n---\n/, "")
  .trim();

let diff = readFileSync(args["diff-file"], "utf8");
let truncated = false;
if (diff.length > MAX_DIFF_CHARS) {
  diff = diff.slice(0, MAX_DIFF_CHARS);
  truncated = true;
}

const prNumber = args["pr-number"] ?? "";
const prTitle = args["pr-title"] ?? "";

const userPrompt = [
  `You are reviewing pull request #${prNumber}: "${prTitle}".`,
  `Respond as reviewer "${provider}".`,
  truncated
    ? "NOTE: the diff below was truncated to fit a size limit; review only what is shown."
    : "",
  "Unified diff:",
  "```diff",
  diff,
  "```",
]
  .filter(Boolean)
  .join("\n\n");

function extractJson(text) {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return { ok: true, value: JSON.parse(t) };
  } catch (err) {
    return { ok: false, raw: text, error: String(err) };
  }
}

// $ per 1M tokens (list price, no cache/batch discounts applied). Anthropic
// figures are from https://platform.claude.com/docs/en/pricing; the GPT-5.5
// figures are from third-party trackers (OpenAI doesn't publish a stable
// pricing page for it) and may drift — update this table when the actual
// billed rate changes. A model missing here simply gets no cost_usd field.
const PRICING_PER_MTOK = {
  "gpt-5.5": { input: 5.0, output: 30.0 },
  "claude-sonnet-5": { input: 3.0, output: 15.0 },
  "claude-opus-5": { input: 5.0, output: 25.0 },
};

function estimateCostUsd(model, usage) {
  if (!usage) return undefined;
  const pricing = PRICING_PER_MTOK[model];
  if (!pricing) return undefined;
  return (
    (usage.input_tokens / 1_000_000) * pricing.input +
    (usage.output_tokens / 1_000_000) * pricing.output
  );
}

async function callWithRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1)
        await new Promise((r) =>
          setTimeout(r, 2000 * (i + 1)),
        );
    }
  }
  throw lastErr;
}

// Normalizes each provider's usage shape to a common { input_tokens, output_tokens,
// total_tokens } so the triage step can report token usage the same way for every reviewer.
function normalizeOpenAiUsage(usage) {
  if (!usage) return undefined;
  return {
    input_tokens: usage.prompt_tokens ?? 0,
    output_tokens: usage.completion_tokens ?? 0,
    total_tokens:
      usage.total_tokens ??
      (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
  };
}

async function callGpt() {
  const model = process.env.GPT_MODEL || "gpt-5.5";
  const res = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: userPrompt },
        ],
      }),
    },
  );
  if (!res.ok)
    throw new Error(
      `OpenAI API error ${res.status}: ${await res.text()}`,
    );
  const body = await res.json();
  return {
    model,
    text: body.choices?.[0]?.message?.content ?? "",
    usage: normalizeOpenAiUsage(body.usage),
  };
}

async function callGrok() {
  const model = process.env.GROK_MODEL || "grok-4";
  const res = await fetch(
    "https://api.x.ai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: instructions },
          {
            role: "user",
            content: `${userPrompt}\n\nRespond with ONLY the JSON object described above — no markdown fences, no prose.`,
          },
        ],
      }),
    },
  );
  if (!res.ok)
    throw new Error(
      `xAI API error ${res.status}: ${await res.text()}`,
    );
  const body = await res.json();
  return {
    model,
    text: body.choices?.[0]?.message?.content ?? "",
    usage: normalizeOpenAiUsage(body.usage),
  };
}

async function callClaude() {
  const model =
    process.env.CLAUDE_REVIEW_MODEL || "claude-opus-5";
  const res = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        system: instructions,
        messages: [
          {
            role: "user",
            content: `${userPrompt}\n\nRespond with ONLY the JSON object described above — no markdown fences, no prose.`,
          },
        ],
      }),
    },
  );
  if (!res.ok)
    throw new Error(
      `Anthropic API error ${res.status}: ${await res.text()}`,
    );
  const body = await res.json();
  const text = (body.content ?? [])
    .map((b) => b.text ?? "")
    .join("");
  const usage = body.usage
    ? {
        input_tokens: body.usage.input_tokens ?? 0,
        output_tokens: body.usage.output_tokens ?? 0,
        total_tokens:
          (body.usage.input_tokens ?? 0) +
          (body.usage.output_tokens ?? 0),
      }
    : undefined;
  return { model, text, usage };
}

const callers = {
  gpt: callGpt,
  grok: callGrok,
  claude: callClaude,
};

const { model, text, usage } = await callWithRetry(() =>
  callers[provider](),
);
if (usage) {
  const costUsd = estimateCostUsd(model, usage);
  if (costUsd !== undefined) usage.cost_usd = costUsd;
}
const parsed = extractJson(text);

const result = parsed.ok
  ? { reviewer: provider, model, usage, ...parsed.value }
  : {
      reviewer: provider,
      model,
      usage,
      summary:
        "Reviewer response was not valid JSON; see parse_error_raw.",
      findings: [],
      parse_error: true,
      parse_error_raw: parsed.raw,
    };

writeFileSync(args.out, JSON.stringify(result, null, 2));
console.log(
  `Wrote ${args.out} (${result.findings?.length ?? 0} findings, parse_error=${!!result.parse_error})`,
);
