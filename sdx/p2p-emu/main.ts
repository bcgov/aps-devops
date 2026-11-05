import { type Config, createApp } from "./server/app.ts";
const root = new URL("./", import.meta.url);
let overrides: Partial<Config> & { port?: number; hostname?: string } = {};
try {
  overrides = JSON.parse(
    await Deno.readTextFile(new URL("config.local.json", root)),
  );
} catch (err) {
  if (!(err instanceof Deno.errors.NotFound)) throw err;
}
const config: Config = {
  issuer: "http://localhost:8000",
  dataDir: new URL("data", root).pathname,
  ttl: 3600,
  ...overrides,
  clientId: Deno.env.get("P2P_CLIENT_ID")?.trim() ?? "",
  tokenUrl: Deno.env.get("P2P_TOKEN_URL")?.trim() ?? "",
};
const handler = await createApp(
  config,
  await Deno.readTextFile(new URL("index.html", root)),
);
const authJs = await Deno.readTextFile(new URL("auth.js", root));
Deno.serve({
  port: overrides.port ?? 8000,
  hostname: overrides.hostname ?? "127.0.0.1",
}, (request) => {
  if (
    request.method === "GET" && new URL(request.url).pathname === "/auth.js"
  ) {
    return new Response(authJs, {
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }
  return handler(request);
});
