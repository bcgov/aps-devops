import { Kafka } from "npm:kafkajs@2.2.4";

const KAFKA_BROKERS = (Deno.env.get("KAFKA_BROKERS") ?? "localhost:9092")
  .split(",")
  .map((b) => b.replace(/^https?:\/\//, ""))
  .map((b) => (b.includes(":") ? b : `${b}:443`));

const GROUP_ID_PREFIX = "kafka-controller";

const kafka = new Kafka({ brokers: KAFKA_BROKERS, ssl: false });

const producer = kafka.producer();
await producer.connect();

const encoder = new TextEncoder();

type StreamConsumer = ReturnType<typeof kafka.consumer>;

// Each SSE connection gets its own ephemeral consumer group (see below), so
// once the consumer disconnects we also delete the group from the broker.
// Otherwise, over a long-lived deployment with frequent client
// reconnects (proxy idle timeouts, browser SSE retry, etc.) these groups
// accumulate indefinitely and add load to the broker's group coordinator.
async function cleanupConsumer(consumer: StreamConsumer, groupId: string) {
  await consumer.disconnect().catch(() => {});
  const admin = kafka.admin();
  try {
    await admin.connect();
    await admin.deleteGroups([groupId]);
  } catch {
    // Best-effort: the group may have already been removed, or still have
    // an in-flight rebalance; it's harmless to leave it for the broker to
    // eventually clean up.
  } finally {
    await admin.disconnect().catch(() => {});
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve({ port: 8000 }, async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const match = url.pathname.match(/^\/([^/]+)\/messages$/);

  if (!match) {
    return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
  }

  const topic = decodeURIComponent(match[1]);

  if (req.method === "POST") {
    let body: { value?: unknown; key?: string; headers?: Record<string, string> };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const value = body.value !== undefined ? JSON.stringify(body.value) : null;
    const key = body.key ?? null;
    const headers = body.headers
      ? Object.fromEntries(
          Object.entries(body.headers).map(([k, v]) => [k, String(v)]),
        )
      : undefined;

    try {
      const result = await producer.send({
        topic,
        messages: [{ key, value, headers }],
      });
      return new Response(JSON.stringify(result[0]), {
        status: 202,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }
  }

  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  let resolvedTopic = topic;
  const isWildcard = resolvedTopic.includes("*");
  const groupId = `${GROUP_ID_PREFIX}-${crypto.randomUUID()}`;
  const consumer = kafka.consumer({ groupId });

  if (isWildcard) {
    resolvedTopic = "/" + resolvedTopic + "/"; // treat as "contains" if it has a wildcard
  }

  const historyParam = url.searchParams.get("history");
  const historyCount = historyParam ? Math.max(0, parseInt(historyParam, 10) || 0) : 0;
  const wantsHistory = historyCount > 0 && !isWildcard;

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: resolvedTopic, fromBeginning: false });
  } catch (err) {
    await consumer.disconnect().catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  let pingInterval: ReturnType<typeof setInterval>;

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Flush the stream open immediately so proxies don't buffer
      controller.enqueue(encoder.encode(`: connected to ${resolvedTopic}\n\n`));

      // Keepalive so the connection doesn't time out between messages
      pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(pingInterval);
        }
      }, 15_000);

      consumer
        .run({
          eachMessage: async ({ message }) => {
            const data = {
              offset: message.offset,
              timestamp: message.timestamp,
              key: message.key?.toString() ?? null,
              value: (() => {
                try {
                  return JSON.parse(message.value?.toString() ?? "null");
                } catch {
                  return message.value?.toString() ?? null;
                }
              })(),
              headers: Object.fromEntries(
                Object.entries(message.headers ?? {}).map(([k, v]) => [
                  k,
                  v?.toString(),
                ]),
              ),
            };
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
              );
            } catch {
              // stream already closed (client disconnected)
            }
          },
        })
        .catch((err) => {
          clearInterval(pingInterval);
          const message = err instanceof Error ? err.message : String(err);
          try {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`,
              ),
            );
            controller.close();
          } catch {
            /* already closed */
          }
          cleanupConsumer(consumer, groupId).catch(() => {});
        });

      if (wantsHistory) {
        // Resolve offsets at join time (not before consumer.connect()) so the
        // window between "read the watermarks" and "seek to them" is as small
        // as possible — a wide window lets retention delete the target offset
        // out from under us, causing "offset out of range" on the first fetch.
        consumer.on(consumer.events.GROUP_JOIN, async () => {
          const admin = kafka.admin();
          try {
            await admin.connect();
            const offsets = await admin.fetchTopicOffsets(topic);
            for (const o of offsets) {
              const high = parseInt(o.offset ?? "0", 10);
              const low = parseInt(o.low ?? "0", 10);
              // Clamp to the earliest offset the broker still retains, not
              // just 0 — otherwise a topic that has aged past its retention
              // window computes a start offset that no longer exists.
              const start = Math.min(high, Math.max(low, high - historyCount));
              try {
                consumer.seek({ topic, partition: o.partition, offset: start.toString() });
              } catch {
                // partition not assigned to this consumer; ignore
              }
            }
          } catch {
            // Best-effort history replay; fall back to live-only streaming
            // rather than failing the whole connection.
          } finally {
            await admin.disconnect().catch(() => {});
          }
        });
      }
    },
    cancel() {
      clearInterval(pingInterval);
      return cleanupConsumer(consumer, groupId);
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...CORS_HEADERS,
    },
  });
});

console.log("Listening on http://localhost:8000");
console.log("GET  /{topic}/messages[?history=N] — SSE stream (replay last N messages, then live)");
console.log("POST /{topic}/messages — publish a message to the topic");
