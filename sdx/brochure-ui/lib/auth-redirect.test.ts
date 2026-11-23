import {
  CONNECTION_ACTION_PATHS,
  loginReturnTo,
  redirectStrayConnectionAction,
  safeReturnTo,
  SESSION_EXPIRED_MESSAGE,
} from "./auth-redirect.ts";

const BASE = "http://sdx-ui.example";

function assertEquals(actual: unknown, expected: unknown, msg?: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${msg ? msg + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function post(path: string, referer?: string): Request {
  return new Request(BASE + path, {
    method: "POST",
    headers: referer ? { referer } : {},
    body: new URLSearchParams({ org: "demo-provider" }),
  });
}

function split(returnTo: string) {
  const u = new URL(returnTo, BASE);
  return { path: u.pathname, params: Object.fromEntries(u.searchParams) };
}

Deno.test("GET keeps the requested page as returnTo", () => {
  assertEquals(
    loginReturnTo(new Request(BASE + "/connections?org=demo-provider")),
    "/connections?org=demo-provider",
  );
});

Deno.test("expired Customize save returns to the connections page, never the POST endpoint (APS-5058)", () => {
  const returnTo = loginReturnTo(
    post(
      "/connections/edit",
      BASE + "/connections?org=demo-provider&subsystem=MIN.APP",
    ),
  );
  assertEquals(split(returnTo), {
    path: "/connections",
    params: {
      org: "demo-provider",
      subsystem: "MIN.APP",
      flash: "error",
      msg: SESSION_EXPIRED_MESSAGE,
    },
  });
});

Deno.test("every connection action returns to /connections when the Referer is missing", () => {
  for (const path of CONNECTION_ACTION_PATHS) {
    const { path: target, params } = split(loginReturnTo(post(path)));
    assertEquals(target, "/connections", path);
    assertEquals(params.flash, "error", path);
  }
});

Deno.test("a Referer that is itself an action endpoint is not used as returnTo", () => {
  assertEquals(
    split(loginReturnTo(post("/connections/approve", BASE + "/connections/edit"))).path,
    "/connections",
  );
});

Deno.test("Referer from another site keeps only its path on this host", () => {
  assertEquals(
    split(loginReturnTo(post("/connections/edit", "https://evil.example/connections?org=x"))),
    {
      path: "/connections",
      params: { org: "x", flash: "error", msg: SESSION_EXPIRED_MESSAGE },
    },
  );
});

Deno.test("non-connection POST returns to the submitting page without a flash", () => {
  assertEquals(
    loginReturnTo(post("/somewhere", BASE + "/runtimes?org=a")),
    "/runtimes?org=a",
  );
  assertEquals(loginReturnTo(post("/somewhere")), "/");
});

Deno.test("safeReturnTo rejects off-site redirect targets", () => {
  for (const raw of [
    null,
    "",
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "/\t/evil.example/",
    "javascript:alert(1)",
  ]) {
    assertEquals(safeReturnTo(raw), "/", String(raw));
  }
  assertEquals(safeReturnTo("/connections?org=a"), "/connections?org=a");
});

Deno.test("GET on a connection action redirects to /connections instead of 405", () => {
  for (const path of CONNECTION_ACTION_PATHS) {
    const res = redirectStrayConnectionAction(new Request(BASE + path + "?org=a"));
    assertEquals(res?.status, 303, path);
    assertEquals(res?.headers.get("location"), "/connections?org=a", path);
  }
});

Deno.test("lifecycle actions use the connection action redirects", () => {
  const { path, params } = split(
    loginReturnTo(post("/connections/lifecycle")),
  );
  assertEquals(path, "/connections");
  assertEquals(params.flash, "error");
  assertEquals(params.msg, SESSION_EXPIRED_MESSAGE);

  const res = redirectStrayConnectionAction(
    new Request(BASE + "/connections/lifecycle?org=a"),
  );
  assertEquals(res?.status, 303);
  assertEquals(res?.headers.get("location"), "/connections?org=a");
});

Deno.test("POST to a connection action and other paths are not intercepted", () => {
  assertEquals(redirectStrayConnectionAction(post("/connections/edit")), null);
  assertEquals(
    redirectStrayConnectionAction(new Request(BASE + "/connections?org=a")),
    null,
  );
});

Deno.test("Common SSO actions retain the page and organization without a Referer", () => {
  const action = "/connections/edit?returnPath=%2Fconsole%2Fcommon-sso&org=demo";
  const loginTarget = new URL(loginReturnTo(post(action)), BASE);
  assertEquals(loginTarget.pathname, "/console/common-sso");
  assertEquals(loginTarget.searchParams.get("org"), "demo");
  assertEquals(loginTarget.searchParams.get("flash"), "error");

  const response = redirectStrayConnectionAction(new Request(BASE + action));
  assertEquals(response?.status, 303);
  assertEquals(response?.headers.get("location"), "/console/common-sso?org=demo");
});
