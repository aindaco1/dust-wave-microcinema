import test from "node:test";
import assert from "node:assert/strict";
import { runtime } from "../scripts/runtime.mjs";

test("series API, individual pages, end date, calendar identity, sitemap, privacy and conflict protection", async (t) => {
  const { mf, origin } = await runtime();
  t.after(() => mf.dispose());
  let cookie = "",
    csrf = "";
  const req = (path, data, auth = false) =>
    mf.dispatchFetch(origin + path, {
      method: data ? "POST" : "GET",
      headers: {
        Origin: origin,
        ...(data ? { "Content-Type": "application/json" } : {}),
        ...(auth ? { Cookie: cookie, "x-dustwave-csrf": csrf } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  const login = await (
    await req("/api/login", { email: "alonso@dustwave.xyz" })
  ).json();
  const exchange = await req("/api/session", {
    token: new URL(login.localLoginUrl).hash.slice(7),
  });
  cookie = exchange.headers.get("Set-Cookie").split(";")[0];
  csrf = (await exchange.json()).csrf;
  const day = (offset) =>
    new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  let event = {
    id: crypto.randomUUID(),
    revision: 0,
    slug: "weekly-readings",
    title: "Weekly reading test",
    titleEs: "Lectura semanal",
    description: "Bring a script.",
    date: day(1),
    time: "19:00",
    endTime: "21:00",
    repeat: "weekly",
    repeatUntil: day(15),
    status: "draft",
    mode: "walkin",
    infoUrl: "https://dustwave.xyz/writers-group.html#readings",
    infoLabel: "Reading lineup",
  };
  let saved = await req("/api/admin/events", event, true);
  assert.equal(saved.status, 200);
  event = (await saved.json()).event;
  const path = `/events/weekly-readings/${day(1)}`;
  assert.equal((await req(path)).status, 404);
  assert.equal((await req(path + ".ics")).status, 404);
  saved = await req(
    "/api/admin/events",
    { ...event, status: "published" },
    true,
  );
  event = (await saved.json()).event;
  assert.equal((await req(path)).status, 200);
  const home = await (await req("/")).text();
  const titles = [
    ...home.matchAll(/<h[23]><a[^>]*>(Weekly reading test)<\/a><\/h[23]>/g),
  ];
  assert.equal(titles.length, 3);
  assert(home.includes(`/events/weekly-readings/${day(15)}`));
  assert(!home.includes(`/events/weekly-readings/${day(22)}`));
  assert.equal((await req(`/events/weekly-readings/${day(22)}`)).status, 404);
  const detail = await (await req(path)).text();
  assert(detail.includes("Reading lineup"));
  assert(detail.includes("https://dustwave.xyz/writers-group.html#readings"));
  assert((await (await req("/es" + path)).text()).includes("Lectura semanal"));
  const original = await (await req(path + ".ics")).text();
  assert.equal(original.match(/BEGIN:VEVENT/g).length, 1);
  assert(!original.includes("RRULE"));
  assert((await (await req("/sitemap.xml")).text()).includes(path));
  const previous = event;
  saved = await req(
    "/api/admin/events",
    {
      ...event,
      exceptions: [
        {
          on: day(1),
          date: day(2),
          time: "18:00",
          endDate: day(2),
          endTime: "20:00",
          cancelled: false,
        },
        {
          on: day(8),
          date: day(8),
          time: "19:00",
          endDate: day(8),
          endTime: "21:00",
          cancelled: true,
        },
      ],
    },
    true,
  );
  assert.equal(saved.status, 200);
  event = (await saved.json()).event;
  assert.equal((await req("/api/admin/events", previous, true)).status, 409);
  const updated = await (await req(path + ".ics")).text();
  assert.equal(original.match(/UID:.*/)[0], updated.match(/UID:.*/)[0]);
  assert.notEqual(
    original.match(/DTSTART:.*/)[0],
    updated.match(/DTSTART:.*/)[0],
  );
  assert.match(updated, /SEQUENCE:3/);
  assert.match(
    await (await req(`/events/weekly-readings/${day(8)}.ics`)).text(),
    /STATUS:CANCELLED/,
  );
  saved = await req(
    "/api/admin/events",
    { ...event, repeatUntil: day(8) },
    true,
  );
  event = (await saved.json()).event;
  assert.equal((await req(`/events/weekly-readings/${day(15)}`)).status, 404);
  assert.equal(
    (
      await req(
        "/api/admin/events/remove",
        { id: event.id, revision: event.revision },
        true,
      )
    ).status,
    200,
  );
  assert.equal((await req(path)).status, 404);
  assert.equal((await req(path + ".ics")).status, 404);
  assert(
    !(await (await req("/sitemap.xml")).text()).includes(
      "/events/weekly-readings/",
    ),
  );
});
