import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

const originalLog = console.log;

console.log = (...args) => {
  originalLog(`[${new Date().toISOString()}]`, ...args);
};

function encodeTarHeader(name: string, size: number): Uint8Array {
  const enc = new TextEncoder();
  const header = new Uint8Array(512);
  const set = (offset: number, maxLen: number, value: string) => {
    header.set(enc.encode(value).slice(0, maxLen), offset);
  };
  set(0, 100, name);
  set(100, 8, "0000644\0");
  set(108, 8, "0000000\0");
  set(116, 8, "0000000\0");
  set(124, 12, size.toString(8).padStart(11, "0") + "\0");
  set(
    136,
    12,
    Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, "0") + "\0",
  );
  header.fill(0x20, 148, 156); // checksum placeholder: spaces
  header[156] = 0x30; // type '0' = regular file
  set(257, 6, "ustar\0");
  set(263, 2, "00");
  let checksum = 0;
  for (let i = 0; i < 512; i++) checksum += header[i];
  set(148, 8, checksum.toString(8).padStart(6, "0") + "\0 ");
  return header;
}

async function createOpalBundle(
  policies: Array<{ pkg: string; policy: string }>,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const blocks: Uint8Array[] = [];

  const addFile = (name: string, content: Uint8Array) => {
    blocks.push(encodeTarHeader(name, content.length));
    const padded = new Uint8Array(Math.ceil(content.length / 512) * 512);
    padded.set(content);
    blocks.push(padded);
  };

  addFile(
    ".manifest",
    enc.encode(
      JSON.stringify({ revision: new Date().toISOString(), roots: [""] }),
    ),
  );

  for (const { pkg, policy } of policies) {
    addFile(pkg.replace(/\./g, "/") + ".rego", enc.encode(policy));
  }

  blocks.push(new Uint8Array(1024)); // end-of-archive

  const totalSize = blocks.reduce((sum, b) => sum + b.length, 0);
  const tar = new Uint8Array(totalSize);
  let offset = 0;
  for (const block of blocks) {
    tar.set(block, offset);
    offset += block.length;
  }

  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(tar);
      controller.close();
    },
  });
  const chunks: Uint8Array[] = [];
  await inputStream.pipeThrough(new CompressionStream("gzip")).pipeTo(
    new WritableStream({
      write(chunk) {
        chunks.push(chunk);
      },
    }),
  );
  const gzipped = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let pos = 0;
  for (const chunk of chunks) {
    gzipped.set(chunk, pos);
    pos += chunk.length;
  }
  return gzipped;
}

const OPAL_WEBHOOK_URL = Deno.env.get("OPAL_WEBHOOK_URL");
const OPAL_CLIENT_TOKEN = Deno.env.get("OPAL_CLIENT_TOKEN");

function notifyOpal(): void {
  console.log("Notifying Opal of policy change...", OPAL_WEBHOOK_URL);
  const headers: HeadersInit = {};
  if (OPAL_CLIENT_TOKEN) {
    headers["Authorization"] = `Bearer ${OPAL_CLIENT_TOKEN}`;
  }
  fetch(OPAL_WEBHOOK_URL, { method: "POST", headers }).catch((err) => {
    console.error("Failed to notify Opal of policy change", err);
  });
}

await Deno.mkdir("./data", { recursive: true });

const db = new DB("./data/sqlite.db");

db.execute(`
  CREATE TABLE IF NOT EXISTS policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package TEXT NOT NULL UNIQUE,
    policy TEXT NOT NULL
  )
`);

Deno.addSignalListener("SIGTERM", () => {
  db.close();
  Deno.exit(0);
});

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === "GET" && path === "/policies") {
    const rows = db.query<[number, string, string]>(
      "SELECT id, package, policy FROM policies",
    );
    return Response.json(
      rows.map(([id, pkg, policy]) => ({ id, package: pkg, policy })),
    );
  }

  if (req.method === "POST" && path === "/policies") {
    const body = await req.json();
    const { package: pkg, policy } = body;
    db.query("INSERT INTO policies (package, policy) VALUES (?, ?)", [
      pkg,
      policy,
    ]);
    const id = db.lastInsertRowId;
    notifyOpal();
    return Response.json({ id, package: pkg, policy }, { status: 201 });
  }

  const policyMatch = path.match(/^\/policies\/(.+)$/);

  if (req.method === "GET" && policyMatch) {
    const pkg = decodeURIComponent(policyMatch[1]);
    const rows = db.query<[number, string]>(
      "SELECT id, policy FROM policies WHERE package = ?",
      [pkg],
    );
    if (rows.length === 0) return new Response("Not Found", { status: 404 });
    const [id, policy] = rows[0];
    return Response.json({ id, package: pkg, policy });
  }

  if (req.method === "PUT" && policyMatch) {
    const pkg = decodeURIComponent(policyMatch[1]);
    const body = await req.json();
    const { policy } = body;
    db.query(
      `INSERT INTO policies (package, policy) VALUES (?, ?)
       ON CONFLICT(package) DO UPDATE SET policy = excluded.policy`,
      [pkg, policy],
    );
    const rows = db.query<[number]>(
      "SELECT id FROM policies WHERE package = ?",
      [pkg],
    );
    const id = rows[0][0];
    notifyOpal();
    return Response.json({ id, package: pkg, policy });
  }

  if (req.method === "DELETE" && policyMatch) {
    const pkg = decodeURIComponent(policyMatch[1]);
    db.query("DELETE FROM policies WHERE package = ?", [pkg]);
    notifyOpal();
    return new Response(null, { status: 204 });
  }

  if (req.method === "GET" && path === "/bundle.tar.gz") {
    const rows = db.query<[string, string]>(
      "SELECT package, policy FROM policies",
    );
    const policies = rows.map(([pkg, policy]) => ({ pkg, policy }));
    const bundle = await createOpalBundle(policies);
    const digest = await crypto.subtle.digest("SHA-256", bundle);
    const etag = `"${Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}"`;

    console.log("Serving bundle with ETag:", etag);

    return new Response(bundle, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Disposition": 'attachment; filename="bundle.tar.gz"',
        ETag: etag,
      },
    });
  }

  return new Response("Not Found", { status: 404 });
};

console.log("Listening on port 8000");
Deno.serve({ port: 8000 }, handler);
