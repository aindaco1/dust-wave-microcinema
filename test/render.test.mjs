import test from "node:test";
import assert from "node:assert/strict";
import { programme } from "../src/render.js";

const env = { SITE_BASE: "https://dustwavemicrocinema.com" };
const event = (slug, offset) => ({
  slug,
  title: slug,
  description: "A screening.",
  details: "",
  price: "Free admission",
  mode: "walkin",
  status: "published",
  startsAt: new Date(Date.now() + offset * 86400000).toISOString(),
  endsAt: new Date(Date.now() + offset * 86400000 + 3600000).toISOString(),
});

test("the next event appears once, later events stay ordered, and a sole event has no empty list", () => {
  const first = event("first-screening", 1);
  const second = event("second-screening", 2);
  const third = event("third-screening", 3);
  for (const lang of ["en", "es"]) {
    const html = programme([third, first, second], lang, env);
    const titles = [
      ...html.matchAll(/<h[23]><a[^>]*>([^<]+)<\/a><\/h[23]>/g),
    ].map((match) => match[1]);
    assert.deepEqual(titles, [first.title, second.title, third.title]);
    const schedule = html.match(
      /<section class="schedule"[^>]*>(.*?)<\/section>/s,
    )[1];
    assert(!schedule.includes(first.slug));
    assert.match(schedule, lang === "en" ? /2 EVENTS/ : /2 EVENTOS/);
    const sole = programme([first], lang, env);
    assert(sole.includes(first.title));
    assert(!sole.includes('class="schedule"'));
    assert(!sole.includes('class="empty-state"'));
    assert(programme([], lang, env).includes('class="empty-state"'));
  }
});

test("the archive retains every past event in reverse chronological order", () => {
  const older = event("older-screening", -3);
  const recent = event("recent-screening", -1);
  for (const lang of ["en", "es"]) {
    const html = programme(
      [older, recent, event("future-screening", 1)],
      lang,
      env,
      true,
    );
    const titles = [...html.matchAll(/<h3><a[^>]*>([^<]+)<\/a><\/h3>/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(titles, [recent.title, older.title]);
    assert(!html.includes('class="featured"'));
  }
});
