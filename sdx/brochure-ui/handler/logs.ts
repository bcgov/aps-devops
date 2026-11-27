import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { openLogStream } from "../data.ts";
import { config } from "../lib/config.ts";
import { LogsPage } from "../pages/LogsPage.tsx";
import { VerificationBadge } from "../components/custom/VerificationBadge.tsx";
import { verifyActivityEvent } from "../lib/verification.ts";
import { authEnabled } from "../lib/auth.ts";
import type { SessionUser } from "../lib/auth.ts";
import { htmlResponse } from "./http.ts";

function makeVerifyingTransform(): TransformStream<
  Uint8Array,
  Uint8Array
> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  async function transformBlock(
    block: string,
  ): Promise<string> {
    const lines = block.split(/\r?\n/);
    const dataIdx = lines.findIndex((l) => l.startsWith("data:"));
    if (dataIdx === -1) return block;
    const payload = lines[dataIdx]
      .slice("data:".length)
      .trimStart();
    // deno-lint-ignore no-explicit-any
    let event: any;
    try {
      event = JSON.parse(payload);
    } catch {
      return block;
    }
    if (!event || typeof event !== "object" || !event.value) {
      return block;
    }
    try {
      const verification = await verifyActivityEvent(
        event.value,
      );
      if (verification) {
        event.verification = verification;
        event.verificationHtml = renderToStaticMarkup(
          React.createElement(VerificationBadge, {
            verification,
          }),
        );
      }
    } catch (e) {
      const msg = (e as Error).message;
      const err = {
        status: "error" as const,
        message: msg,
      };
      event.verification = {
        edgeToken: { request: err, response: err },
        entitySig: { request: err, response: err },
      };
    }
    lines[dataIdx] = `data: ${JSON.stringify(event)}`;
    return lines.join("\n");
  }

  return new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const sep = /\r?\n\r?\n/;
      let match: RegExpExecArray | null;
      while ((match = sep.exec(buffer)) !== null) {
        const block = buffer.slice(0, match.index);
        buffer = buffer.slice(
          match.index + match[0].length,
        );
        const transformed = await transformBlock(block);
        controller.enqueue(
          encoder.encode(transformed + "\n\n"),
        );
      }
    },
    flush(controller) {
      if (buffer.length > 0) {
        controller.enqueue(encoder.encode(buffer));
      }
    },
  });
}

export function handleLogs(url: URL, user: SessionUser | null): Response {
  const path = url.pathname;
  if (authEnabled && !user) {
    const returnTo = encodeURIComponent(
      path + url.search,
    );
    return new Response(null, {
      status: 302,
      headers: {
        location: `/auth/login?returnTo=${returnTo}`,
      },
    });
  }
  return htmlResponse(
    React.createElement(LogsPage, {
      logStreamUrl: "/log-stream",
      config,
      currentPath: "/logs",
      user,
    }),
  );
}

export async function handleLogStream(req: Request): Promise<Response> {
  try {
    const upstream = await openLogStream(req.signal);
    if (!upstream.ok || !upstream.body) {
      return new Response(
        `upstream HTTP ${upstream.status}`,
        {
          status: 502,
          headers: { "content-type": "text/plain" },
        },
      );
    }
    const body = upstream.body.pipeThrough(
      makeVerifyingTransform(),
    );
    return new Response(body, {
      headers: {
        "content-type": upstream.headers.get("content-type") ??
          "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response((e as Error).message, {
      status: 502,
      headers: { "content-type": "text/plain" },
    });
  }
}
