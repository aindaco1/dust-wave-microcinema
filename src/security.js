import {
  randomToken,
  sha256Hex,
  timingSafeEqual,
  getCookie,
} from "@dustwave/worker-core/crypto";
import {
  createSessionCookie,
  isTrustedSameOriginRequest,
} from "@dustwave/worker-core/session-security";
import { SECURITY_HEADERS } from "@dustwave/worker-core/http";
import { verifyTurnstile } from "@dustwave/worker-core/turnstile";
import { readJsonObject } from "@dustwave/worker-core/request-validation";
import { fail, email } from "./domain.js";
export const origin = (env) => new URL(env.SITE_BASE).origin;
export const local = (env) =>
  env.APP_MODE === "local" &&
  ["localhost", "127.0.0.1"].includes(new URL(env.SITE_BASE).hostname);
export const allowed = (env, address) =>
  (env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .includes(address);
export function headers(extra = {}) {
  return {
    ...SECURITY_HEADERS,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    ...extra,
  };
}
export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: headers({
      "Content-Type": "application/json; charset=utf-8",
      ...extra,
    }),
  });
}
export function sameOrigin(req, env) {
  if (
    !isTrustedSameOriginRequest(req, origin(env), { allowMissingSource: false })
  )
    fail("origin_denied", 403);
}
export async function body(req, max = 40000) {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    fail("invalid_content_type", 415);
  return readJsonObject(req, max);
}
export async function limit(req, env, scope, max = 10, seconds = 900) {
  const ip =
    req.headers.get("CF-Connecting-IP") || (local(env) ? "local" : "unknown");
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const key = await sha256Hex(scope + ":" + ip + ":" + bucket);
  const r = await env.DB.prepare(
    "INSERT INTO limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
  )
    .bind(key, (bucket + 1) * seconds * 1000)
    .first();
  if (r.count > max) fail("rate_limited", 429);
}
export async function challenge(req, env, token, action) {
  if (local(env)) return;
  if (!env.TURNSTILE_SITE_KEY || !env.TURNSTILE_SECRET_KEY)
    fail("challenge_not_configured", 503);
  const r = await verifyTurnstile(
    req,
    { ...env, CHALLENGE_REQUIRED: "true" },
    token,
    { action, requiredEnvName: "CHALLENGE_REQUIRED" },
  );
  if (!r.ok) fail(r.code, r.status);
}
function cookie(value, env, age = 43200) {
  return createSessionCookie("dw_microcinema", value, {
    requestUrl: origin(env),
    maxAgeSeconds: age,
    sameSite: "Strict",
    secure: !local(env),
  });
}
export async function admin(req, env) {
  let token;
  try {
    token = getCookie(req, "dw_microcinema");
  } catch {
    fail("unauthorized", 401);
  }
  if (!token || token.length > 256) fail("unauthorized", 401);
  const row = await env.DB.prepare(
    "SELECT * FROM sessions WHERE hash=? AND expires_at>?",
  )
    .bind(await sha256Hex(token), Date.now())
    .first();
  if (!row || !allowed(env, row.email)) fail("unauthorized", 401);
  if (!["GET", "HEAD"].includes(req.method)) {
    sameOrigin(req, env);
    if (!timingSafeEqual(req.headers.get("x-dustwave-csrf"), row.csrf))
      fail("csrf_failed", 403);
  }
  return row;
}
export async function auth(req, env, path) {
  if (path === "/api/login" && req.method === "POST") {
    sameOrigin(req, env);
    await limit(req, env, "login", 8);
    const data = await body(req, 5000);
    const address = email(data.email);
    await challenge(req, env, data.token, "login");
    if (!allowed(env, address)) return json({ sent: true });
    const token = randomToken(),
      hash = await sha256Hex(token);
    await env.DB.prepare(
      "INSERT INTO login_tokens(hash,email,expires_at) VALUES (?,?,?)",
    )
      .bind(hash, address, Date.now() + 900000)
      .run();
    const url = `${origin(env)}${data.lang === "es" ? "/es" : ""}/admin/#token=${token}`;
    if (local(env)) return json({ localLoginUrl: url });
    try {
      const r = await env.EMAIL.send({
        from: { email: env.LOGIN_FROM, name: "Dust Wave Microcinema" },
        to: address,
        subject:
          data.lang === "es"
            ? "Tu enlace de acceso al Microcine"
            : "Your Microcinema sign-in link",
        text: `${data.lang === "es" ? "Este enlace caduca en 15 minutos." : "This sign-in link expires in 15 minutes."}\n\n${url}`,
      });
      if (!r?.messageId) throw new Error("send_failed");
    } catch {
      await env.DB.prepare("DELETE FROM login_tokens WHERE hash=?")
        .bind(hash)
        .run();
      fail("login_unavailable", 503);
    }
    return json({ sent: true });
  }
  if (path === "/api/session" && req.method === "POST") {
    sameOrigin(req, env);
    await limit(req, env, "exchange", 30);
    const data = await body(req, 2000);
    if (typeof data.token !== "string" || data.token.length > 256)
      fail("invalid_login", 401);
    const row = await env.DB.prepare(
      "DELETE FROM login_tokens WHERE hash=? AND expires_at>? RETURNING email",
    )
      .bind(await sha256Hex(data.token), Date.now())
      .first();
    if (!row || !allowed(env, row.email)) fail("invalid_login", 401);
    const token = randomToken(),
      csrf = randomToken();
    await env.DB.prepare(
      "INSERT INTO sessions(hash,email,csrf,expires_at) VALUES (?,?,?,?)",
    )
      .bind(await sha256Hex(token), row.email, csrf, Date.now() + 43200000)
      .run();
    return json({ email: row.email, csrf }, 200, {
      "Set-Cookie": cookie(token, env),
    });
  }
  if (path === "/api/session" && req.method === "GET") {
    const row = await admin(req, env);
    return json({ email: row.email, csrf: row.csrf });
  }
  if (path === "/api/logout" && req.method === "POST") {
    const row = await admin(req, env);
    await env.DB.prepare("DELETE FROM sessions WHERE hash=?")
      .bind(row.hash)
      .run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie("", env, 0) });
  }
  return null;
}
