import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { Kafka } from "npm:kafkajs";
import type { Consumer } from "npm:kafkajs";

interface Webhook {
  id: number;
  conn_id: string;
  topic: string;
  webhook_url: string;
}

const INTERVAL_SECONDS = parseInt(Deno.env.get("INTERVAL_SECONDS") ?? "60");
const KAFKA_BROKERS = (Deno.env.get("KAFKA_BROKERS") ?? "kafka:9092").split(
  ",",
);
const KAFKA_GROUP_ID =
  Deno.env.get("KAFKA_GROUP_ID") ?? "pubsub-webhooks-group";

function setupDatabase(): DB {
  Deno.mkdirSync("./data", { recursive: true });
  const db = new DB("./data/sqlite.db");
  db.execute(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conn_id TEXT NOT NULL UNIQUE,
      topic TEXT NOT NULL,
      webhook_url TEXT NOT NULL
    )
  `);
  // migration: add unique index for existing databases created before UNIQUE was in the schema
  db.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_webhooks_conn_id ON webhooks (conn_id)`,
  );
  return db;
}

const db = setupDatabase();

async function handler(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  try {
    if (pathname === "/webhooks") {
      if (req.method === "GET") {
        const rows = db.queryEntries<Webhook>("SELECT * FROM webhooks");
        return Response.json(rows);
      }

      if (req.method === "PUT") {
        const body = await req.json();
        const { conn_id, topic, webhook_url } = body;
        if (!conn_id || !topic || !webhook_url) {
          return Response.json(
            { error: "conn_id, topic, and webhook_url are required" },
            { status: 400 },
          );
        }
        db.query(
          `INSERT INTO webhooks (conn_id, topic, webhook_url)
           VALUES (?, ?, ?)
           ON CONFLICT(conn_id) DO UPDATE SET
             topic = excluded.topic,
             webhook_url = excluded.webhook_url`,
          [conn_id, topic, webhook_url],
        );
        const [row] = db.queryEntries<Webhook>(
          "SELECT * FROM webhooks WHERE conn_id = ?",
          [conn_id],
        );
        return Response.json(row);
      }

      if (req.method === "POST") {
        const body = await req.json();
        const { conn_id, topic, webhook_url } = body;
        if (!conn_id || !topic || !webhook_url) {
          return Response.json(
            { error: "conn_id, topic, and webhook_url are required" },
            { status: 400 },
          );
        }
        db.query(
          "INSERT INTO webhooks (conn_id, topic, webhook_url) VALUES (?, ?, ?)",
          [conn_id, topic, webhook_url],
        );
        const [row] = db.queryEntries<Webhook>(
          "SELECT * FROM webhooks WHERE id = ?",
          [db.lastInsertRowId],
        );
        return Response.json(row, { status: 201 });
      }
    }

    const idMatch = pathname.match(/^\/webhooks\/(\d+)$/);
    if (idMatch) {
      const id = parseInt(idMatch[1]);

      if (req.method === "GET") {
        const [row] = db.queryEntries<Webhook>(
          "SELECT * FROM webhooks WHERE id = ?",
          [id],
        );
        if (!row) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json(row);
      }

      if (req.method === "PUT") {
        const [existing] = db.queryEntries<Webhook>(
          "SELECT * FROM webhooks WHERE id = ?",
          [id],
        );
        if (!existing)
          return Response.json({ error: "Not found" }, { status: 404 });
        const body = await req.json();
        const conn_id = body.conn_id ?? existing.conn_id;
        const topic = body.topic ?? existing.topic;
        const webhook_url = body.webhook_url ?? existing.webhook_url;
        db.query(
          "UPDATE webhooks SET conn_id = ?, topic = ?, webhook_url = ? WHERE id = ?",
          [conn_id, topic, webhook_url, id],
        );
        const [updated] = db.queryEntries<Webhook>(
          "SELECT * FROM webhooks WHERE id = ?",
          [id],
        );
        return Response.json(updated);
      }

      if (req.method === "DELETE") {
        const [existing] = db.queryEntries<Webhook>(
          "SELECT * FROM webhooks WHERE id = ?",
          [id],
        );
        if (!existing)
          return Response.json({ error: "Not found" }, { status: 404 });
        db.query("DELETE FROM webhooks WHERE id = ?", [id]);
        return new Response(null, { status: 204 });
      }
    }
  } catch (err) {
    console.error("Handler error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

let consumer: Consumer | null = null;

async function runCycle() {
  if (consumer) {
    try {
      await consumer.disconnect();
    } catch {
      /* ignore disconnect errors */
    }
    consumer = null;
  }

  const rows = db.queryEntries<Webhook>("SELECT * FROM webhooks");
  const topics = [...new Set(rows.map((r) => r.topic))];

  if (topics.length === 0) return;

  const kafka = new Kafka({ brokers: KAFKA_BROKERS });
  consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });

  try {
    await consumer.connect();
    await consumer.subscribe({ topics, fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const webhooks = db.queryEntries<Webhook>(
          "SELECT * FROM webhooks WHERE topic = ?",
          [topic],
        );
        const payload = message.value?.toString() ?? "{}";
        await Promise.allSettled(
          webhooks.map((w) => {
            console.log(
              "Triggering webhook",
              w.webhook_url,
              "for topic",
              topic,
            );
            fetch(w.webhook_url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payload,
            });
          }),
        );
      },
    });
  } catch (err) {
    console.error(
      "Kafka error, will retry next cycle:",
      err instanceof Error ? err.message : err,
    );
    try {
      await consumer.disconnect();
    } catch {
      /* ignore */
    }
    consumer = null;
  }
}

const server = Deno.serve({ port: 8000 }, handler);

runCycle().catch((err) =>
  console.error(
    "Initial cycle error:",
    err instanceof Error ? err.message : err,
  ),
);
const intervalId = setInterval(runCycle, INTERVAL_SECONDS * 1000);

Deno.addSignalListener("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down...");
  clearInterval(intervalId);
  if (consumer) {
    try {
      await consumer.disconnect();
    } catch {
      /* ignore */
    }
  }
  db.close();
  await server.shutdown();
  Deno.exit(0);
});
