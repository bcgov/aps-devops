import { handleLogStream } from "./log-stream.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

for (
  const [authConfigured, signedIn, status] of [
    [false, false, 503],
    [false, true, 503],
    [true, false, 401],
  ] as const
) {
  Deno.test(`log stream denies access (${authConfigured}, ${signedIn})`, async () => {
    const response = await handleLogStream(
      new Request("http://localhost/log-stream"),
      {
        authConfigured,
        signedIn,
        upstreamUrl: "http://kafka/sdx/messages",
        transform: () => {
          throw new Error("must not transform");
        },
        fetcher: () => {
          throw new Error("must not fetch");
        },
      },
    );
    assert(response.status === status, `expected ${status}`);
    assert(
      response.headers.get("cache-control") === "no-store",
      "must not cache",
    );
    await response.body?.cancel();
  });
}

Deno.test("authenticated log stream forwards SSE and request cancellation", async () => {
  const req = new Request("http://localhost/log-stream");
  const response = await handleLogStream(req, {
    authConfigured: true,
    signedIn: true,
    upstreamUrl: "http://kafka/sdx/messages",
    transform: () => new TransformStream(),
    fetcher: (url, init) => {
      assert(url === "http://kafka/sdx/messages", "wrong upstream");
      assert(
        (init as { signal?: AbortSignal })?.signal === req.signal,
        "missing disconnect signal",
      );
      return Promise.resolve(new Response("data: {}\n\n"));
    },
  });
  assert(response.status === 200, "expected success");
  assert(
    response.headers.get("content-type") === "text/event-stream",
    "expected SSE",
  );
  assert(await response.text() === "data: {}\n\n", "lost event");
});

for (const fails of [false, true]) {
  Deno.test(`upstream failure is a non-sensitive 502 (throws=${fails})`, async () => {
    const response = await handleLogStream(
      new Request("http://localhost/log-stream"),
      {
        authConfigured: true,
        signedIn: true,
        upstreamUrl: "http://kafka/sdx/messages",
        transform: () => new TransformStream(),
        fetcher: () => {
          if (fails) throw new Error("private broker details");
          return Promise.resolve(
            new Response("private broker details", { status: 500 }),
          );
        },
      },
    );
    assert(response.status === 502, "expected gateway failure");
    assert(
      await response.text() === "log stream unavailable",
      "leaked upstream error",
    );
  });
}
