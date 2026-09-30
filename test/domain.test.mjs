import test from "node:test";
import assert from "node:assert/strict";
import {
  calendar,
  localInstant,
  validateEvent,
  externalUrl,
  escape,
} from "../src/domain.js";
const event = () =>
  validateEvent({
    slug: "a-film",
    title: "A film",
    description: "A room; a film, a conversation.\nOne more line.",
    date: "2026-10-10",
    time: "19:00",
    endTime: "21:00",
    status: "published",
    mode: "walkin",
  });
test("Albuquerque dates handle summer/winter, midnight, invalid dates and DST edges", () => {
  assert.equal(localInstant("2026-10-10", "19:00"), "2026-10-11T01:00:00.000Z");
  assert.equal(localInstant("2026-12-10", "19:00"), "2026-12-11T02:00:00.000Z");
  assert.equal(localInstant("2026-10-10", "00:00"), "2026-10-10T06:00:00.000Z");
  for (const [day, time] of [
    ["2026-02-30", "19:00"],
    ["2026-03-08", "02:30"],
    ["2026-10-10", "25:00"],
  ])
    assert.throws(() => localInstant(day, time), { code: "invalid_date" });
  assert.throws(() => localInstant("2026-11-01", "01:30"), {
    code: "ambiguous_time",
  });
});
test("event requirements, end times, stable URLs and HTTPS link policy", () => {
  const e = event();
  assert.throws(() => validateEvent({ ...e, endTime: "18:00" }), {
    code: "invalid_end_time",
  });
  assert.throws(() => validateEvent({ ...e, mode: "rsvp", url: "" }), {
    code: "required",
  });
  assert.throws(() => externalUrl("javascript:alert(1)", "rsvp"), {
    code: "invalid_url",
  });
  assert.throws(
    () => externalUrl("https://shop.dustwave.xyz.evil.example/", "tickets"),
    { code: "shop_url_required" },
  );
  assert.equal(
    externalUrl("https://shop.dustwave.xyz/example", "tickets"),
    "https://shop.dustwave.xyz/example",
  );
  assert.throws(() => validateEvent({ ...e, slug: "changed" }, e), {
    code: "slug_locked",
  });
  assert.equal(
    validateEvent({ ...e, endDate: "2026-10-11", endTime: "01:00" }, e).endsAt,
    "2026-10-11T07:00:00.000Z",
  );
});
test("calendar escaping, UTF-8 folding, stable UID, updates and cancellation", () => {
  const e = event();
  e.title = "Película ".repeat(30);
  const result = calendar(e, "https://dustwavemicrocinema.com", "es");
  assert.match(result, /DTSTART:20261011T010000Z\r\n/);
  assert.match(result, /DTEND:20261011T030000Z\r\n/);
  assert.match(
    result,
    /A room\\; a film\\, a conversation\.\\nOne more line\./,
  );
  assert(!result.replace(/\r\n/g, "").includes("\n"));
  for (const line of result.split("\r\n"))
    assert(Buffer.byteLength(line) <= 75);
  const unfolded = result.replace(/\r\n /g, "");
  assert(unfolded.includes(e.title));
  assert(unfolded.includes("/es/events/a-film"));
  const updated = calendar(
    { ...e, status: "cancelled", revision: 2 },
    "https://dustwavemicrocinema.com",
  );
  assert.match(updated, /STATUS:CANCELLED/);
  assert.match(updated, /SEQUENCE:2/);
  assert(updated.includes(`UID:${e.id}@`));
});
test("HTML escaping preserves text without executable markup", () => {
  assert.equal(
    escape("<img \"x\"> & 'a'"),
    "&lt;img &quot;x&quot;&gt; &amp; &#39;a&#39;",
  );
});
