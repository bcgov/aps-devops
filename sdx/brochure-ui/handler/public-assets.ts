import { readPublicAsset } from "../data.ts";
import { notFound } from "./http.ts";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  woff: "font/woff",
  woff2: "font/woff2",
};

export async function servePublic(
  pathname: string,
): Promise<Response> {
  const rel = pathname.slice("/public/".length);
  if (!rel || rel.includes("..") || rel.startsWith("/")) {
    return notFound();
  }
  try {
    const file = await readPublicAsset(rel);
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
    return new Response(file, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return notFound();
  }
}
