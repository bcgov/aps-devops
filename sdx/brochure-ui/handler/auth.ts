import { authEnabled, completeLogin, logout, startLogin } from "../lib/auth.ts";
import { safeReturnTo } from "../lib/auth-redirect.ts";

export async function handleLogin(req: Request, url: URL): Promise<Response> {
  if (!authEnabled) {
    return new Response("auth not configured", {
      status: 503,
    });
  }
  const returnTo = safeReturnTo(
    url.searchParams.get("returnTo"),
  );
  return await startLogin(req, returnTo);
}

export async function handleAuthCallback(req: Request): Promise<Response> {
  if (!authEnabled) {
    return new Response("auth not configured", {
      status: 503,
    });
  }
  return await completeLogin(req);
}

export async function handleLogout(req: Request): Promise<Response> {
  return await logout(req);
}
