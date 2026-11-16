import { parseHistoryCount } from "./history.ts";

Deno.test("history defaults to live-only and accepts bounded integer counts", () => {
  for (
    const [input, expected] of [[null, 0], ["0", 0], ["10", 10], [
      "1000",
      1000,
    ]] as const
  ) {
    if (parseHistoryCount(input) !== expected) {
      throw new Error(`invalid result for ${input}`);
    }
  }
});

Deno.test("history rejects malformed and unbounded replay before opening a consumer", () => {
  for (
    const input of [
      "",
      "-1",
      "1.5",
      "10junk",
      "1e2",
      "Infinity",
      "1001",
      "9007199254740993",
    ]
  ) {
    if (parseHistoryCount(input) !== null) throw new Error(`accepted ${input}`);
  }
});
