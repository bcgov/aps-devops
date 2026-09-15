import { parse } from "@std/yaml";

const PROMETHEUS_URL =
  Deno.env.get("PROMETHEUS_URL") ??
  "https://thanos-prom.apps.gold.devops.gov.bc.ca";

export interface MetricsQuery {
  name: string;
  description: string;
  query: string;
}

const yamlText = await Deno.readTextFile(
  new URL("../metrics-queries.yaml", import.meta.url),
);
const { queries } = parse(yamlText) as { queries: MetricsQuery[] };

const QUERY_INDEX = new Map(queries.map((q) => [q.name, q]));

export function listQueries(): MetricsQuery[] {
  return queries;
}

function parseRangeSeconds(range: string): number {
  const match = range.match(/^(\d+)([smhdw])$/);
  if (!match) return 3600;
  const n = parseInt(match[1]);
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };
  return n * (multipliers[match[2]] ?? 3600);
}

function getStep(rangeSeconds: number): string {
  if (rangeSeconds <= 900) return "15";
  if (rangeSeconds <= 3600) return "60";
  if (rangeSeconds <= 86400) return "300";
  if (rangeSeconds <= 604800) return "3600";
  return "86400";
}

export class MetricsQueryNotFoundError extends Error {
  constructor(name: string) {
    super(`Query '${name}' not found`);
    this.name = "MetricsQueryNotFoundError";
  }
}

// deno-lint-ignore no-explicit-any
export async function runQuery(name: string, dateRange = "1h"): Promise<any> {
  const q = QUERY_INDEX.get(name);
  if (!q) throw new MetricsQueryNotFoundError(name);

  const rangeSeconds = parseRangeSeconds(dateRange);
  const now = Math.floor(Date.now() / 1000);
  const start = now - rangeSeconds;
  const step = getStep(rangeSeconds);

  const promUrl = new URL(`${PROMETHEUS_URL}/api/v1/query_range`);
  promUrl.searchParams.set("query", q.query);
  promUrl.searchParams.set("start", String(start));
  promUrl.searchParams.set("end", String(now));
  promUrl.searchParams.set("step", step);

  const response = await fetch(promUrl.toString());
  if (!response.ok) {
    throw new Error(`Prometheus HTTP ${response.status}`);
  }
  return await response.json();
}
