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

  const seekTargets: Array<{ topic: string; partition: number; offset: string }> = [];

  try {
    if (historyCount > 0 && !isWildcard) {
      const admin = kafka.admin();
      await admin.connect();
      try {
        const offsets = await admin.fetchTopicOffsets(topic);
        for (const o of offsets) {
          const high = parseInt(o.offset ?? "0", 10);
          const start = Math.max(0, high - historyCount);
          seekTargets.push({ topic, partition: o.partition, offset: start.toString() });
        }
      } finally {
        await admin.disconnect().catch(() => {});
      }
    }

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
        });

      if (seekTargets.length > 0) {
        consumer.on(consumer.events.GROUP_JOIN, () => {
          for (const target of seekTargets) {
            try {
              consumer.seek(target);
            } catch {
              // partition not assigned to this consumer; ignore
            }
          }
        });
      }
    },
    cancel() {
      clearInterval(pingInterval);
      consumer.disconnect().catch(() => {});
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
