import { readBoundedBytes } from "@dustwave/worker-core/request-validation";
import {
  text,
  email,
  fail,
  validateEvent,
  localInstant,
  calendar,
  escape,
  ADDRESS,
  isSeries,
  occurrence,
  expandEvents,
  windowEnd,
} from "./domain.js";
import {
  auth,
  admin,
  body,
  challenge,
  headers,
  json,
  limit,
  local,
  origin,
  sameOrigin,
} from "./security.js";
import {
  programme,
  eventPage,
  visitPage,
  proposalPage,
  adminPage,
  privacyPage,
  notFound,
} from "./render.js";
const uuid = (s) =>
  typeof s === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s);
const parse = (row) =>
  row
    ? { ...JSON.parse(row.data), revision: row.revision, status: row.status }
    : null;
export async function allEvents(env, privateList = false) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM events ${privateList ? "" : "WHERE status IN ('published','cancelled')"} ORDER BY starts_at`,
  ).all();
  return results.map(parse);
}
async function getEvent(env, id) {
  return parse(
    await env.DB.prepare("SELECT * FROM events WHERE id=?").bind(id).first(),
  );
}
async function api(req, env, path) {
  const authentication = await auth(req, env, path);
  if (authentication) return authentication;
  if (path === "/api/proposals" && req.method === "POST") {
    sameOrigin(req, env);
    await limit(req, env, "proposal", 8);
    const data = await body(req, 16000);
    if (data.website) fail("invalid_request");
    if (!uuid(data.id)) fail("invalid_request");
    // Reconcile a retried submission before consuming another single-use challenge.
    const existing = await env.DB.prepare("SELECT id FROM proposals WHERE id=?")
      .bind(data.id)
      .first();
    if (existing) return json({ ok: true });
    const proposal = {
      title: text(data.title, 160, true),
      description: text(data.description, 6000, true),
      date: text(data.date, 10, true),
      time: text(data.time, 5, true),
      name: text(data.name, 100, true),
      email: email(data.email),
      lang: data.lang === "es" ? "es" : "en",
    };
    if (localInstant(proposal.date, proposal.time) <= new Date().toISOString())
      fail("invalid_date");
    await challenge(req, env, data.token, "proposal");
    await env.DB.prepare(
      "INSERT OR IGNORE INTO proposals(id,state,created_at,data) VALUES (?,'pending',?,?)",
    )
      .bind(data.id, new Date().toISOString(), JSON.stringify(proposal))
      .run();
    return json({ ok: true }, 201);
  }
  if (path.startsWith("/api/admin/")) {
    const session = await admin(req, env);
    if (path === "/api/admin/events" && req.method === "GET")
      return json({ events: await allEvents(env, true) });
    if (path === "/api/admin/proposals" && req.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM proposals WHERE state='pending' ORDER BY created_at DESC",
      ).all();
      return json({
        proposals: results.map((r) => ({
          id: r.id,
          createdAt: r.created_at,
          ...JSON.parse(r.data),
        })),
      });
    }
    if (path === "/api/admin/proposals/dismiss" && req.method === "POST") {
      const data = await body(req, 1000);
      if (!uuid(data.id)) fail("invalid_request");
      await env.DB.prepare(
        "UPDATE proposals SET state='dismissed' WHERE id=? AND state='pending'",
      )
        .bind(data.id)
        .run();
      return json({ ok: true });
    }
    if (path === "/api/admin/events" && req.method === "POST") {
      const data = await body(req);
      if (!uuid(data.id)) fail("invalid_request");
      const old = await getEvent(env, data.id);
      if (old?.status === "removed") fail("conflict", 409);
      if ((old?.revision || 0) !== data.revision) fail("conflict", 409);
      const event = validateEvent(data, old);
      event.id = data.id;
      const collision = await env.DB.prepare(
        "SELECT id FROM events WHERE slug=? AND id<>?",
      )
        .bind(event.slug, event.id)
        .first();
      if (collision) fail("slug_taken", 409);
      if (
        event.image.startsWith("/media/") &&
        !(await env.IMAGES.head(event.image.slice(7)))
      )
        fail("invalid_image");
      let proposal = null;
      if (data.proposalId) {
        proposal = await env.DB.prepare(
          "SELECT id FROM proposals WHERE id=? AND state='pending'",
        )
          .bind(data.proposalId)
          .first();
        if (!proposal || data.id !== proposal.id || old) fail("conflict", 409);
      }
      const stmt = old
        ? env.DB.prepare(
            "UPDATE events SET status=?,starts_at=?,ends_at=?,updated_at=?,revision=?,data=? WHERE id=? AND revision=? RETURNING id",
          ).bind(
            event.status,
            event.startsAt,
            event.endsAt,
            event.updatedAt,
            event.revision,
            JSON.stringify(event),
            event.id,
            data.revision,
          )
        : env.DB.prepare(
            "INSERT OR IGNORE INTO events(id,slug,status,starts_at,ends_at,updated_at,revision,data) VALUES (?,?,?,?,?,?,?,?) RETURNING id",
          ).bind(
            event.id,
            event.slug,
            event.status,
            event.startsAt,
            event.endsAt,
            event.updatedAt,
            event.revision,
            JSON.stringify(event),
          );
      let result;
      if (proposal) {
        const results = await env.DB.batch([
          stmt,
          env.DB.prepare(
            "UPDATE proposals SET state='accepted' WHERE id=? AND EXISTS (SELECT 1 FROM events WHERE id=?)",
          ).bind(proposal.id, proposal.id),
        ]);
        result = results[0].results[0];
      } else result = await stmt.first();
      if (!result) fail("conflict", 409);
      return json({ event });
    }
    if (
      ["/api/admin/events/remove", "/api/admin/events/restore"].includes(
        path,
      ) &&
      req.method === "POST"
    ) {
      const data = await body(req, 1000),
        old = await getEvent(env, data.id);
      if (!old) fail("not_found", 404);
      if (data.revision !== old.revision) fail("conflict", 409);
      const status = path.endsWith("restore") ? "draft" : "removed";
      const e = {
        ...old,
        status,
        updatedAt: new Date().toISOString(),
        revision: old.revision + 1,
      };
      const r = await env.DB.prepare(
        "UPDATE events SET status=?,revision=?,updated_at=?,data=? WHERE id=? AND revision=? RETURNING id",
      )
        .bind(
          status,
          e.revision,
          e.updatedAt,
          JSON.stringify(e),
          e.id,
          old.revision,
        )
        .first();
      if (!r) fail("conflict", 409);
      return json({ ok: true });
    }
    if (path === "/api/admin/images" && req.method === "POST") {
      await limit(req, env, "upload", 40);
      const bytes = await readBoundedBytes(req, 2 * 1024 * 1024);
      const decoder = new TextDecoder();
      if (
        req.headers.get("content-type") !== "image/webp" ||
        bytes.length < 20 ||
        decoder.decode(bytes.slice(0, 4)) !== "RIFF" ||
        decoder.decode(bytes.slice(8, 12)) !== "WEBP"
      )
        fail("invalid_image");
      const key = crypto.randomUUID() + ".webp";
      await env.IMAGES.put(key, bytes, {
        httpMetadata: { contentType: "image/webp" },
        customMetadata: { owner: session.email },
      });
      return json({ path: "/media/" + key }, 201);
    }
  }
  fail("not_found", 404);
}
function html(content, status = 200) {
  return new Response(content, {
    status,
    headers: headers({
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    }),
  });
}
export default {
  async fetch(req, env) {
    let url = new URL(req.url);
    const lang =
      url.pathname === "/es" || url.pathname.startsWith("/es/") ? "es" : "en";
    let path = url.pathname.replace(/^\/es(?=\/|$)/, "") || "/";
    try {
      if (url.pathname.startsWith("/api/"))
        return await api(req, env, url.pathname);
      if (!["GET", "HEAD"].includes(req.method))
        return json({ error: "method_not_allowed" }, 405, {
          Allow: "GET, HEAD",
        });
      let response;
      if (path.startsWith("/assets/")) response = await env.ASSETS.fetch(req);
      else if (path.startsWith("/media/")) {
        const key = path.slice(7);
        if (!/^[a-f0-9-]{36}\.webp$/.test(key)) fail("not_found", 404);
        const published = await env.DB.prepare(
          "SELECT id FROM events WHERE status IN ('published','cancelled') AND json_extract(data,'$.image')=? LIMIT 1",
        )
          .bind(path)
          .first();
        if (!published) await admin(req, env);
        const object = await env.IMAGES.get(key);
        if (!object) fail("not_found", 404);
        response = new Response(object.body, {
          headers: headers({ "Content-Type": "image/webp" }),
        });
      } else if (path === "/robots.txt")
        response = new Response(
          `User-agent: *\nDisallow: /admin/\nDisallow: /es/admin/\nDisallow: /api/\nSitemap: ${origin(env)}/sitemap.xml\n`,
          { headers: { "Content-Type": "text/plain" } },
        );
      else if (path === "/sitemap.xml") {
        const records = await allEvents(env);
        const events = [
          ...expandEvents(records),
          ...expandEvents(records, { archive: true }),
        ];
        const paths = [
          "/",
          "/archive",
          "/visit",
          "/propose",
          ...events.map((e) => "/events/" + e.slug),
        ];
        response = new Response(
          `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${["", "/es"].flatMap((prefix) => paths.map((p) => `<url><loc>${escape(origin(env) + prefix + p)}</loc></url>`)).join("")}</urlset>`,
          { headers: { "Content-Type": "application/xml" } },
        );
      } else if (path === "/" || path === "/archive")
        response = html(
          programme(await allEvents(env), lang, env, path === "/archive"),
        );
      else if (path === "/visit") response = html(visitPage(lang, env));
      else if (path === "/propose") response = html(proposalPage(lang, env));
      else if (path === "/privacy") response = html(privacyPage(lang, env));
      else if (path === "/admin" || path === "/admin/")
        response = html(adminPage(lang, env));
      else if (
        /^\/events\/[a-z0-9-]+(?:\/\d{4}-\d{2}-\d{2})?(?:\.ics)?$/.test(path)
      ) {
        const isCalendar = path.endsWith(".ics"),
          [slug, on] = path
            .slice(8)
            .replace(/\.ics$/, "")
            .split("/");
        const record = parse(
          await env.DB.prepare(
            "SELECT * FROM events WHERE slug=? AND status IN ('published','cancelled')",
          )
            .bind(slug)
            .first(),
        );
        let e = record;
        if (record && isSeries(record)) {
          e = on
            ? occurrence(record, on)
            : expandEvents([record])[0] ||
              expandEvents([record], { archive: true })[0];
          if (e?.date > windowEnd()) e = null;
          if (e && !on)
            return Response.redirect(
              `${origin(env)}${lang === "es" ? "/es" : ""}/events/${e.slug}${isCalendar ? ".ics" : ""}`,
              302,
            );
        } else if (on) e = null;
        if (!e) response = html(notFound(lang, env), 404);
        else if (isCalendar)
          response = new Response(calendar(e, origin(env), lang), {
            headers: headers({
              "Content-Type": "text/calendar; charset=utf-8",
              "Content-Disposition": `attachment; filename="${slug}${on ? "-" + on : ""}.ics"`,
            }),
          });
        else response = html(eventPage(e, lang, env));
      } else response = html(notFound(lang, env), 404);
      return req.method === "HEAD" ? new Response(null, response) : response;
    } catch (error) {
      const status = error.status || 500,
        code =
          error.code || (status < 500 ? "invalid_request" : "server_error");
      if (status === 500)
        console.error("Microcinema request failed", { path, code });
      if (path.startsWith("/api/")) return json({ error: code }, status);
      if (status === 404 || status === 401)
        return html(notFound(lang, env), 404);
      return html(
        `<!doctype html><html lang="${lang}"><meta charset="utf-8"><title>Dust Wave Microcinema</title><h1>${lang === "es" ? "Volvemos pronto." : "We’ll be back shortly."}</h1><p><a href="mailto:info@dustwave.xyz">info@dustwave.xyz</a></p></html>`,
        status,
      );
    }
  },
  async scheduled(_event, env) {
    const now = Date.now();
    await env.DB.batch(
      ["sessions", "login_tokens", "limits"].map((table) =>
        env.DB.prepare(`DELETE FROM ${table} WHERE expires_at<?`).bind(now),
      ),
    );
  },
};
