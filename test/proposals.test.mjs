import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { runtime } from "../scripts/runtime.mjs";
import {
  drainNotifications,
  notificationStatement,
} from "../src/proposal-notifications.js";
const input = () => ({
  id: crypto.randomUUID(),
  title: "A private screening",
  description: "An event idea",
  date: "2040-10-10",
  time: "19:00",
  name: "Test Organizer",
  email: "organizer@example.test",
  lang: "en",
});
const form = (data, bytes, type = "image/png") => {
  const body = new FormData();
  for (const [key, value] of Object.entries(data)) body.set(key, value);
  if (bytes) body.set("image", new Blob([bytes], { type }), "poster.png");
  return body;
};
async function sendRequest(mf, url, init) {
  // Serialize native FormData before handing bytes to Miniflare's own fetch implementation.
  const request = new Request(url, init);
  return mf.dispatchFetch(url, {
    method: request.method,
    headers: Object.fromEntries(request.headers),
    body: await request.arrayBuffer(),
  });
}
async function signIn(mf, origin) {
  const request = (path, data) =>
    mf.dispatchFetch(origin + path, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  const login = await (
    await request("/api/login", { email: "alonso@dustwave.xyz" })
  ).json();
  const response = await request("/api/session", {
    token: new URL(login.localLoginUrl).hash.slice(7),
  });
  return {
    Cookie: response.headers.get("Set-Cookie").split(";")[0],
    "x-dustwave-csrf": (await response.json()).csrf,
    Origin: origin,
  };
}
test("proposal artwork stays private, transfers to a draft, and publishes only with the event", async (t) => {
  const { mf, db, origin } = await runtime();
  t.after(() => mf.dispose());
  const bytes = await sharp({
    create: { width: 800, height: 400, channels: 3, background: "#203abb" },
  })
    .png()
    .toBuffer();
  const proposal = input();
  const submit = () =>
    sendRequest(mf, origin + "/api/proposals", {
      method: "POST",
      headers: { Origin: origin },
      body: form(proposal, bytes),
    });
  const responses = await Promise.all([submit(), submit()]);
  for (const response of responses) {
    assert([200, 201].includes(response.status), await response.clone().text());
    assert.equal((await response.json()).id, proposal.id);
  }
  const saved = await db
    .prepare("SELECT data FROM proposals WHERE id=?")
    .bind(proposal.id)
    .first();
  const image = JSON.parse(saved.data).image;
  assert.equal((await mf.dispatchFetch(origin + image)).status, 404);
  assert.equal(
    (await (await mf.getR2Bucket("IMAGES")).list()).objects.length,
    1,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM proposal_notifications")
        .first()
    ).n,
    1,
  );
  const again = await submit();
  assert.equal(again.status, 200);
  const changed = await sendRequest(mf, origin + "/api/proposals", {
    method: "POST",
    headers: { Origin: origin },
    body: form({ ...proposal, title: "Changed" }, bytes),
  });
  assert.equal(changed.status, 409);
  const headers = await signIn(mf, origin);
  const pending = await (
    await mf.dispatchFetch(origin + "/api/admin/proposals", { headers })
  ).json();
  assert.equal(pending.proposals[0].image, image);
  assert.equal(pending.proposals[0].notificationStatus, "pending");
  const artwork = await mf.dispatchFetch(origin + image, { headers });
  assert.equal(artwork.status, 200);
  const meta = await sharp(Buffer.from(await artwork.arrayBuffer())).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 640);
  assert.equal(meta.height, 640);
  const payload = {
    ...proposal,
    image,
    revision: 0,
    proposalId: proposal.id,
    slug: "proposal-art",
    status: "draft",
    mode: "walkin",
    endTime: "21:00",
  };
  const draft = await mf.dispatchFetch(origin + "/api/admin/events", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(draft.status, 200);
  const { event } = await draft.json();
  assert.equal(event.image, image);
  assert.equal((await mf.dispatchFetch(origin + image)).status, 404);
  const published = await mf.dispatchFetch(origin + "/api/admin/events", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ...event, status: "published" }),
  });
  assert.equal(published.status, 200);
  assert.equal((await mf.dispatchFetch(origin + image)).status, 200);
  assert(
    !(
      await (await mf.dispatchFetch(origin + "/events/proposal-art")).text()
    ).includes(proposal.email),
  );
});
test("proposal submission is atomic with notification intent, rejects unsafe images and accepts no-image forms", async (t) => {
  const { mf, db, origin } = await runtime();
  t.after(() => mf.dispose());
  const send = (body, headers = {}) =>
    sendRequest(mf, origin + "/api/proposals", {
      method: "POST",
      headers: { Origin: origin, ...headers },
      body,
    });
  assert.equal(
    (await send(form(input()), { Origin: "https://other.example" })).status,
    403,
  );
  assert.equal(
    (
      await send(
        form(
          input(),
          new TextEncoder().encode('<svg onload="bad()"/>'),
          "image/svg+xml",
        ),
      )
    ).status,
    400,
  );
  const small = await sharp({
    create: { width: 50, height: 50, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  assert.equal((await send(form(input(), small))).status, 400);
  assert.equal(
    (await send(form(input(), new Uint8Array(5 * 1024 * 1024 + 1)))).status,
    400,
  );
  const bytes = await sharp({
    create: { width: 200, height: 200, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  await db
    .prepare(
      "CREATE TRIGGER reject_notice BEFORE INSERT ON proposal_notifications BEGIN SELECT RAISE(ABORT, 'test_failure'); END;",
    )
    .run();
  const proposal = input();
  const failed = await send(form(proposal, bytes));
  assert.equal(failed.status, 500);
  assert.equal(
    (await db.prepare("SELECT count(*) AS n FROM proposals").first()).n,
    0,
  );
  assert.equal(
    (await (await mf.getR2Bucket("IMAGES")).list()).objects.length,
    0,
  );
  await db.prepare("DROP TRIGGER reject_notice").run();
  const response = await send(JSON.stringify(proposal), {
    "Content-Type": "application/json",
  });
  assert.equal(response.status, 201);
  assert.equal(
    (
      await db
        .prepare("SELECT count(*) AS n FROM proposal_notifications")
        .first()
    ).n,
    1,
  );
});
test("notification dispatch is private, deduplicated, locally disabled and conservative after uncertain delivery", async (t) => {
  const { mf, db } = await runtime();
  t.after(() => mf.dispose());
  const env = {
    DB: db,
    APP_MODE: "production",
    SITE_BASE: "https://dustwavemicrocinema.com",
    LOGIN_FROM: "microcinema@digest.dustwave.xyz",
    PROPOSAL_NOTIFY_TO: "info@dustwave.xyz",
  };
  const queue = async () => {
    const p = input();
    await db
      .prepare(
        "INSERT INTO proposals(id,state,created_at,data) VALUES (?,'pending',?,?)",
      )
      .bind(p.id, new Date().toISOString(), JSON.stringify(p))
      .run();
    await (await notificationStatement(env, p.id, p)).run();
    return p;
  };
  const p = await queue();
  let messages = [];
  env.EMAIL = {
    async send(payload) {
      messages.push(payload);
      return { messageId: "provider-1" };
    },
  };
  await drainNotifications({
    ...env,
    APP_MODE: "local",
    SITE_BASE: "http://localhost:8793",
  });
  assert.equal(messages.length, 0);
  await Promise.all([drainNotifications(env), drainNotifications(env)]);
  await drainNotifications(env);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, "info@dustwave.xyz");
  assert.equal(messages[0].replyTo, p.email);
  assert.equal(messages[0].headers["Auto-Submitted"], "auto-generated");
  assert(messages[0].text.includes("/admin/#proposals"));
  assert(!messages[0].attachments);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT status FROM proposal_notifications WHERE proposal_id=?",
        )
        .bind(p.id)
        .first()
    ).status,
    "accepted",
  );
  const rate = await queue();
  env.EMAIL = {
    async send() {
      throw Object.assign(new Error("rate"), { code: "E_RATE_LIMIT_EXCEEDED" });
    },
  };
  await drainNotifications(env);
  const retry = await db
    .prepare("SELECT * FROM proposal_notifications WHERE proposal_id=?")
    .bind(rate.id)
    .first();
  assert.equal(retry.status, "pending");
  assert(retry.next_attempt_at > Date.now());
  const unknown = await queue();
  env.EMAIL = {
    async send() {
      throw new Error("connection lost");
    },
  };
  await drainNotifications(env);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT status FROM proposal_notifications WHERE proposal_id=?",
        )
        .bind(unknown.id)
        .first()
    ).status,
    "uncertain",
  );
  const interrupted = await queue();
  await db
    .prepare(
      "UPDATE proposal_notifications SET status='sending',lease_until=0 WHERE proposal_id=?",
    )
    .bind(interrupted.id)
    .run();
  await drainNotifications(env);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT status FROM proposal_notifications WHERE proposal_id=?",
        )
        .bind(interrupted.id)
        .first()
    ).status,
    "uncertain",
  );
  const suppressed = await queue();
  env.EMAIL = {
    async send() {
      throw Object.assign(new Error("suppressed"), {
        code: "E_RECIPIENT_SUPPRESSED",
      });
    },
  };
  await drainNotifications(env);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT status FROM proposal_notifications WHERE proposal_id=?",
        )
        .bind(suppressed.id)
        .first()
    ).status,
    "failed",
  );
});
