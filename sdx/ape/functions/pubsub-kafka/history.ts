/** Replay is bounded per partition; missing history means live events only. */
export function parseHistoryCount(value: string | null): number | null {
  if (value === null) return 0;
  if (!/^\d+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count <= 1000 ? count : null;
}
