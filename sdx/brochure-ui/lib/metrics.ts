import { parse } from "@std/yaml";

const PROMETHEUS_URL = Deno.env.get("PROMETHEUS_URL") ??
  "https://thanos-prom.apps.gold.devops.gov.bc.ca";

function historicalMetricsUrl(): string {
  const configured = Deno.env.get("ISA_PROMETHEUS_URL");
  if (configured) return configured;

  // Existing cluster deployments still point at the short-retention
  // Prometheus service. The sibling Thanos Query service reads archived blocks.
  const liveUrl = new URL(PROMETHEUS_URL);
  const prometheusService = "thanos-prom-prometheus-server";
  if (
    liveUrl.hostname === prometheusService ||
    liveUrl.hostname.startsWith(prometheusService + ".")
  ) {
    liveUrl.hostname = "thanos-query" +
      liveUrl.hostname.slice(prometheusService.length);
    liveUrl.port = "9090";
  }
  return liveUrl.toString().replace(/\/$/, "");
}

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

function metricsQuery(name: string): string {
  const query = QUERY_INDEX.get(name);
  if (!query) throw new MetricsQueryNotFoundError(name);
  return query.query;
}

// deno-lint-ignore no-explicit-any
export async function runQuery(name: string, dateRange = "1h"): Promise<any> {
  const rangeSeconds = parseRangeSeconds(dateRange);
  return await queryRange(
    metricsQuery(name),
    rangeSeconds,
    getStep(rangeSeconds),
  );
}

export async function connectionTraffic() {
  const daySeconds = 86400;
  const days = 30;
  const end = Math.floor(Date.now() / 1000);
  const result = await queryRange(
    metricsQuery("isa_traffic"),
    (days - 1) * daySeconds,
    String(daySeconds),
    end,
    historicalMetricsUrl(),
  );
  if (result.status !== "success") throw new Error("Traffic query failed");
  return {
    ...result,
    dailyTimestamps: Array.from(
      { length: days },
      (_, index) => end - (days - 1 - index) * daySeconds,
    ),
  };
}

async function queryRange(
  query: string,
  rangeSeconds: number,
  step: string,
  now = Math.floor(Date.now() / 1000),
  baseUrl = PROMETHEUS_URL,
) {
  const start = now - rangeSeconds;
  const promUrl = new URL(`${baseUrl.replace(/\/$/, "")}/api/v1/query_range`);
  promUrl.searchParams.set("query", query);
  promUrl.searchParams.set("start", String(start));
  promUrl.searchParams.set("end", String(now));
  promUrl.searchParams.set("step", step);

  const response = await fetch(promUrl.toString());
  if (!response.ok) {
    throw new Error(`Prometheus HTTP ${response.status}`);
  }
  return await response.json();
}
