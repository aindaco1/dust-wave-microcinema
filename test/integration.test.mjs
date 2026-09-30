import test from "node:test";
import assert from "node:assert/strict";
import { runtime } from "../scripts/runtime.mjs";
import { sha256Hex } from "@dustwave/worker-core/crypto";

test("Worker, D1 and R2: login, events, privacy, concurrent editing, proposals and logout", async (t) => {
  const { mf, db, origin } = await runtime();
  t.after(() => mf.dispose());
  let cookie = "",
    csrf = "";
  async function req(
    path,
    { data, method = data ? "POST" : "GET", auth = false, headers = {} } = {},
  ) {
    return mf.dispatchFetch(origin + path, {
      method,
      headers: {
        Origin: origin,
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(auth ? { Cookie: cookie, "x-dustwave-csrf": csrf } : {}),
        ...headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }
  async function ok(path, opts) {
    const r = await req(path, opts);
    const data = await r.json();
    assert(r.ok, JSON.stringify(data));
    return data;
  }
  assert.equal((await req("/api/admin/events")).status, 401);
  assert.equal(
    (
      await req("/api/login", {
        data: { email: "alonso@dustwave.xyz" },
        headers: { Origin: "https://attacker.example" },
      })
    ).status,
    403,
  );
  assert.deepEqual(
    await ok("/api/login", { data: { email: "nobody@example.test" } }),
    { sent: true },
  );
  const login = await ok("/api/login", {
    data: { email: "alonso@dustwave.xyz" },
  });
  const token = new URL(login.localLoginUrl).hash.slice(7);
  const exchange = await req("/api/session", { data: { token } });
  assert.equal(exchange.status, 200);
  cookie = exchange.headers.get("Set-Cookie").split(";")[0];
  csrf = (await exchange.json()).csrf;
  assert.match(exchange.headers.get("Set-Cookie"), /HttpOnly; SameSite=Strict/);
  assert(!exchange.headers.get("Set-Cookie").includes("Domain="));
  assert.equal((await req("/api/session", { data: { token } })).status, 401);
  assert.equal(
    (
      await req("/api/admin/events", {
        auth: true,
        data: {},
        headers: { "x-dustwave-csrf": "" },
      })
    ).status,
    403,
  );
  const input = {
    id: crypto.randomUUID(),
    revision: 0,
    slug: "test-screening",
    title: "A <script>alert(1)</script> film",
    titleEs: "Una película",
    description: "A description",
    descriptionEs: "Una descripción",
    date: "2040-10-10",
    time: "19:00",
    endTime: "21:00",
    mode: "walkin",
    status: "draft",
  };
  let { event } = await ok("/api/admin/events", { data: input, auth: true });
  assert.equal((await req("/events/test-screening")).status, 404);
  assert.equal((await req("/events/test-screening.ics")).status, 404);
  assert(!(await (await req("/")).text()).includes("test-screening"));
  ({ event } = await ok("/api/admin/events", {
    data: { ...event, status: "published" },
    auth: true,
  }));
  const page = await (await req("/events/test-screening")).text();
  assert(page.includes("&lt;script&gt;"));
  assert(!page.includes("<script>alert"));
  assert(page.includes("Add to calendar"));
  const spanish = await (await req("/es/events/test-screening")).text();
  assert(spanish.includes("Una película"));
  assert(spanish.includes("Una descripción"));
  assert(spanish.includes("/es/events/test-screening.ics"));
  const ics = await req("/events/test-screening.ics");
  assert.match(ics.headers.get("Content-Type"), /text\/calendar/);
  assert.match(await ics.text(), /BEGIN:VEVENT/);
  const writes = await Promise.all(
    ["First edit", "Second edit"].map((title) =>
      req("/api/admin/events", { data: { ...event, title }, auth: true }),
    ),
  );
  assert.deepEqual(writes.map((r) => r.status).sort(), [200, 409]);
  event = (await ok("/api/admin/events", { auth: true })).events.find(
    (e) => e.id === event.id,
  );
  assert.equal(
    (
      await req("/api/admin/events", {
        data: { ...event, mode: "tickets", url: "https://bad.example/" },
        auth: true,
      })
    ).status,
    400,
  );
  ({ event } = await ok("/api/admin/events", {
    data: {
      ...event,
      mode: "tickets",
      url: "https://shop.dustwave.xyz/test",
      title: "Tickets test",
    },
    auth: true,
  }));
  assert(
    (await (await req("/events/test-screening")).text()).includes(
      'href="https://shop.dustwave.xyz/test"',
    ),
  );
  ({ event } = await ok("/api/admin/events", {
    data: { ...event, status: "cancelled" },
    auth: true,
  }));
  assert(
    (await (await req("/events/test-screening")).text()).includes("Cancelled"),
  );
  assert.match(
    await (await req("/events/test-screening.ics")).text(),
    /STATUS:CANCELLED/,
  );
  await ok("/api/admin/events/remove", {
    data: { id: event.id, revision: event.revision },
    auth: true,
  });
  assert.equal((await req("/events/test-screening")).status, 404);
  event = (await ok("/api/admin/events", { auth: true })).events.find(
    (e) => e.id === event.id,
  );
  await ok("/api/admin/events/restore", {
    data: { id: event.id, revision: event.revision },
    auth: true,
  });
  assert.equal((await req("/events/test-screening")).status, 404);
  const past = {
    ...input,
    id: crypto.randomUUID(),
    slug: "past-film",
    title: "An archived film",
    date: "2000-01-01",
    status: "published",
  };
  await ok("/api/admin/events", { data: past, auth: true });
  assert((await (await req("/archive")).text()).includes("An archived film"));
  assert(!(await (await req("/")).text()).includes("An archived film"));
  const proposal = {
    id: crypto.randomUUID(),
    title: "Private proposal",
    description: "A public description",
    date: "2040-11-12",
    time: "19:00",
    name: "Private Person",
    email: "private@example.test",
  };
  await ok("/api/proposals", { data: proposal });
  await ok("/api/proposals", { data: proposal });
  const pending = await ok("/api/admin/proposals", { auth: true });
  assert.equal(pending.proposals.length, 1);
  assert(!(await (await req("/")).text()).includes("Private Person"));
  assert(
    !(await (await req("/sitemap.xml")).text()).includes(
      "private@example.test",
    ),
  );
  await ok("/api/admin/events", {
    data: {
      ...input,
      id: proposal.id,
      slug: "from-proposal",
      proposalId: proposal.id,
      title: proposal.title,
      status: "draft",
    },
    auth: true,
  });
  assert.equal(
    (await ok("/api/admin/proposals", { auth: true })).proposals.length,
    0,
  );
  assert.equal(
    (
      await req("/api/admin/events", {
        data: {
          ...input,
          id: proposal.id,
          slug: "from-proposal",
          proposalId: proposal.id,
        },
        auth: true,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await req("/api/admin/images", {
        method: "POST",
        auth: true,
        headers: { "Content-Type": "image/svg+xml" },
        data: {},
      })
    ).status,
    400,
  );
  const mediaKey = crypto.randomUUID() + ".webp";
  const bucket = await mf.getR2Bucket("IMAGES");
  await bucket.put(mediaKey, new Uint8Array([1, 2, 3]));
  assert.equal((await req("/media/" + mediaKey)).status, 404);
  assert.equal((await req("/media/" + mediaKey, { auth: true })).status, 200);
  assert.equal((await req("/visit", { method: "HEAD" })).status, 200);
  assert.equal(await (await req("/visit", { method: "HEAD" })).text(), "");
  assert.equal(
    (
      await req("/api/admin/events", {
        data: {},
        auth: true,
        headers: { Origin: "https://evil.example" },
      })
    ).status,
    403,
  );
  const expired = await ok("/api/login", {
    data: { email: "alonso@dustwave.xyz" },
  });
  const expiredToken = new URL(expired.localLoginUrl).hash.slice(7);
  await db
    .prepare("UPDATE login_tokens SET expires_at=0 WHERE hash=?")
    .bind(await sha256Hex(expiredToken))
    .run();
  assert.equal(
    (await req("/api/session", { data: { token: expiredToken } })).status,
    401,
  );
  await ok("/api/logout", { data: {}, auth: true });
  assert.equal((await req("/api/admin/events", { auth: true })).status, 401);
});
test("production fails closed without challenge configuration and never exposes local sign-in", async (t) => {
  const { mf } = await runtime({ production: true });
  t.after(() => mf.dispose());
  const r = await mf.dispatchFetch(
    "https://dustwavemicrocinema.com/api/login",
    {
      method: "POST",
      headers: {
        Origin: "https://dustwavemicrocinema.com",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "alonso@dustwave.xyz" }),
    },
  );
  assert.equal(r.status, 503);
  const payload = await r.json();
  assert.equal(payload.error, "challenge_not_configured");
  assert(!payload.localLoginUrl);
  const page = await (
    await mf.dispatchFetch("https://dustwavemicrocinema.com/")
  ).text();
  assert(!page.includes("sample programme"));
  assert(page.includes("The next programme is taking shape."));
});
