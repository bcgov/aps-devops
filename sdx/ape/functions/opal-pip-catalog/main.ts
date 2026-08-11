import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";
import { parse as parseYaml } from "jsr:@std/yaml";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "npm:jose";

const originalLog = console.log;

console.log = (...args) => {
  originalLog(`[${new Date().toISOString()}]`, ...args);
};

const OPAL_SERVER_URL =
  Deno.env.get("OPAL_SERVER_URL") || "http://localhost:7002";

const JWKS_URI = `${OPAL_SERVER_URL}/.well-known/jwks.json`;
const OPAL_DATA_CONFIG_URL = `${OPAL_SERVER_URL}/data/config`;

const jwks = createRemoteJWKSet(new URL(JWKS_URI));

await Deno.mkdir("./data", { recursive: true });

const db = new DB("./data/sqlite.db");

db.execute(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    url TEXT NOT NULL,
    topics TEXT NOT NULL DEFAULT '[]',
    dst_path TEXT NOT NULL
  )
`);

// Migration: add name column to existing tables
try {
  db.execute(`ALTER TABLE entries ADD COLUMN name TEXT`);
} catch {
  // column already exists
}

db.execute(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_name ON entries(name)`,
);

interface EntryRow {
  [key: string]: unknown;
  id: number;
  name: string | null;
  url: string;
  topics: string;
  dst_path: string;
}

interface Entry {
  id: number;
  name: string | null;
  url: string;
  topics: string[];
  dst_path: string;
  config?: { headers: { Authorization: string } };
}

function deserialize(row: EntryRow): Entry {
  return {
    ...row,
    topics: JSON.parse(row.topics),
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  const text = await req.text();
  if (contentType.includes("yaml") || contentType.includes("yml")) {
    return parseYaml(text) as Record<string, unknown>;
  }
  return JSON.parse(text);
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  if (path === "/entries" && method === "GET") {
    const token = url.searchParams.get("token");
    let claims: JWTPayload | undefined;

    if (token) {
      try {
        const { payload } = await jwtVerify(token, jwks);
        claims = payload;
      } catch (err) {
        console.warn("Invalid token:", token, err);
        return json({ error: "invalid token found in pip catalog" }, 401);
      }
    }

    console.log(
      "GET Entries " + (claims ? `for ${claims.sub}` : "without token"),
    );

    const rows = db.queryEntries<EntryRow>("SELECT * FROM entries ORDER BY id");

    const result = {
      entries: rows.map(deserialize).map((entry) => ({
        ...{ url: entry.url, dst_path: entry.dst_path, topics: entry.topics },
        ...(token && {
          config: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }),
      })),
      ...(claims && { claims }),
    };
    console.log("Returning entries:", JSON.stringify(result, null, 4));
    return json(result);
  }

  if (path === "/entries" && method === "POST") {
    const body = await parseBody(req);
    const entryUrl = body.url as string | undefined;
    const dstPath = body.dst_path as string | undefined;
    const name = body.name as string | undefined;
    if (!entryUrl) return json({ error: "url is required" }, 400);
    if (!dstPath) return json({ error: "dst_path is required" }, 400);
    const topics = JSON.stringify(
      Array.isArray(body.topics) ? body.topics : [],
    );
    db.query(
      "INSERT INTO entries (name, url, topics, dst_path) VALUES (?, ?, ?, ?)",
      [name ?? null, entryUrl, topics, dstPath],
    );
    const [row] = db.queryEntries<EntryRow>(
      "SELECT * FROM entries WHERE id = ?",
      [db.lastInsertRowId],
    );
    return json(deserialize(row), 201);
  }

  if (path === "/entries" && method === "PUT") {
    const body = await parseBody(req);
    const name = body.name as string | undefined;
    const entryUrl = body.url as string | undefined;
    const dstPath = body.dst_path as string | undefined;
    if (!name) return json({ error: "name is required" }, 400);
    if (!entryUrl) return json({ error: "url is required" }, 400);
    if (!dstPath) return json({ error: "dst_path is required" }, 400);
    const topics = JSON.stringify(
      Array.isArray(body.topics) ? body.topics : [],
    );
    db.query(
      `INSERT INTO entries (name, url, topics, dst_path) VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET url=excluded.url, topics=excluded.topics, dst_path=excluded.dst_path`,
      [name, entryUrl, topics, dstPath],
    );
    console.log("PUT /entries called for", name);
    const [row] = db.queryEntries<EntryRow>(
      "SELECT * FROM entries WHERE name = ?",
      [name],
    );
    return json(deserialize(row), 200);
  }

  const entryMatch = path.match(/^\/entries\/(\d+)$/);
  if (entryMatch) {
    const id = Number(entryMatch[1]);

    if (method === "GET") {
      const [row] = db.queryEntries<EntryRow>(
        "SELECT * FROM entries WHERE id = ?",
        [id],
      );
      if (!row) return json({ error: "not found" }, 404);
      return json(deserialize(row));
    }

    if (method === "DELETE") {
      const [row] = db.queryEntries<EntryRow>(
        "SELECT * FROM entries WHERE id = ?",
        [id],
      );
      if (!row) return json({ error: "not found" }, 404);
      db.query("DELETE FROM entries WHERE id = ?", [id]);
      return new Response(null, { status: 204 });
    }
  }

  return json({ error: "not found" }, 404);
}

Deno.addSignalListener("SIGTERM", () => {
  Deno.exit(0);
});

console.log("Listening on http://localhost:8000");
Deno.serve({ port: 8000 }, handler);
