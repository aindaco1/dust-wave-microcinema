import test from "node:test";
import assert from "node:assert/strict";
import {
  validateEvent,
  expandEvents,
  occurrence,
  calendar,
  windowEnd,
} from "../src/domain.js";
const makeSeries = (extra = {}) =>
  validateEvent({
    slug: "writers-group",
    title: "Writers Group",
    description: "Read and discuss scripts.",
    date: "2026-10-05",
    time: "19:00",
    endTime: "21:00",
    mode: "walkin",
    status: "published",
    repeat: "fortnightly",
    ...extra,
  });
const now = new Date("2026-10-01T04:00:00Z"); // September 30 in Albuquerque.

test("recurring listings fill three calendar months and roll forward, including month ends", () => {
  assert.equal(windowEnd(now), "2026-12-30");
  assert.equal(windowEnd(new Date("2027-01-31T19:00:00Z")), "2027-04-30");
  assert.equal(windowEnd(new Date("2027-11-30T19:00:00Z")), "2028-02-29");
  const series = makeSeries();
  assert.deepEqual(
    expandEvents([series], { now }).map((e) => e.date),
    [
      "2026-10-05",
      "2026-10-19",
      "2026-11-02",
      "2026-11-16",
      "2026-11-30",
      "2026-12-14",
      "2026-12-28",
    ],
  );
  const later = new Date("2026-11-06T18:00:00Z");
  const next = expandEvents([series], { now: later });
  assert.equal(next[0].date, "2026-11-16");
  assert.equal(next.at(-1).date, "2027-01-25");
  assert.deepEqual(
    expandEvents([series], { now: later, archive: true }).map((e) => e.date),
    ["2026-11-02", "2026-10-19", "2026-10-05"],
  );
  assert.equal(new Set(next.map((e) => e.id)).size, next.length);
  const overnight = makeSeries({ endDate: "2026-10-06", endTime: "01:00" });
  assert.equal(occurrence(overnight, "2026-11-02").endDate, "2026-11-03");
});

test("repeat end date is inclusive and does not erase past meeting pages", () => {
  assert.throws(() => makeSeries({ repeat: "constructor" }), {
    code: "invalid_repeat",
  });
  const series = makeSeries({ repeatUntil: "2026-11-02" });
  assert.deepEqual(
    expandEvents([series], { now }).map((e) => e.date),
    ["2026-10-05", "2026-10-19", "2026-11-02"],
  );
  assert.equal(occurrence(series, "2026-11-16"), null);
  assert.equal(
    expandEvents([series], { now: "2027-01-01T18:00:00Z" }).length,
    0,
  );
  assert.equal(
    expandEvents([series], { now: "2027-01-01T18:00:00Z", archive: true })
      .length,
    3,
  );
  assert.throws(() => makeSeries({ repeatUntil: "2026-10-04" }), {
    code: "invalid_repeat_end",
  });
  assert.throws(
    () =>
      validateEvent(
        { ...series, date: "2026-10-06", endDate: "2026-10-06" },
        series,
      ),
    { code: "series_locked" },
  );
  assert.throws(() => validateEvent({ ...series, repeat: "weekly" }, series), {
    code: "series_locked",
  });
  assert.equal(occurrence(series, "2026-10-06"), null);
  assert.equal(occurrence(series, "2026-02-30"), null);
});

test("each meeting has a standalone calendar with stable identity through rescheduling and DST", () => {
  const series = makeSeries();
  const october = occurrence(series, "2026-10-19");
  const november = occurrence(series, "2026-11-02");
  assert.equal(october.startsAt, "2026-10-20T01:00:00.000Z");
  assert.equal(november.startsAt, "2026-11-03T02:00:00.000Z");
  const moved = validateEvent(
    {
      ...series,
      exceptions: [
        {
          on: "2026-10-19",
          date: "2026-10-20",
          time: "18:00",
          endDate: "2026-10-20",
          endTime: "20:00",
          cancelled: false,
        },
        {
          on: "2026-11-02",
          date: "2026-11-02",
          time: "19:00",
          endDate: "2026-11-02",
          endTime: "21:00",
          cancelled: true,
        },
      ],
    },
    series,
  );
  const updated = occurrence(moved, "2026-10-19");
  assert.equal(updated.id, october.id);
  assert.equal(updated.slug, october.slug);
  assert.equal(updated.date, "2026-10-20");
  const ics = calendar(updated, "https://dustwavemicrocinema.com");
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 1);
  assert(!ics.includes("RRULE"));
  assert.match(ics, /DTSTART:20261021T000000Z/);
  assert.match(ics, /SEQUENCE:2/);
  assert.match(
    calendar(
      occurrence(moved, "2026-11-02"),
      "https://dustwavemicrocinema.com",
    ),
    /STATUS:CANCELLED/,
  );
  assert.equal(occurrence(moved, "2026-11-16").status, "published");
  assert.throws(
    () =>
      makeSeries({
        exceptions: [{ ...moved.exceptions[0], on: "2026-10-06" }],
      }),
    { code: "invalid_exception" },
  );
  assert.throws(
    () =>
      makeSeries({ exceptions: [moved.exceptions[0], moved.exceptions[0]] }),
    { code: "invalid_exception" },
  );
  assert.throws(() => makeSeries({ date: "2026-10-04", time: "01:00" }), {
    code: "recurrence_time",
  });
});

test("moved meetings are filtered by their actual date, even across the rolling window", () => {
  const series = makeSeries({
    exceptions: [
      {
        on: "2027-01-11",
        date: "2026-12-29",
        time: "19:00",
        endDate: "2026-12-29",
        endTime: "21:00",
        cancelled: false,
      },
      {
        on: "2026-10-19",
        date: "2027-01-12",
        time: "19:00",
        endDate: "2027-01-12",
        endTime: "21:00",
        cancelled: false,
      },
    ],
  });
  const upcoming = expandEvents([series], { now });
  assert(upcoming.some((e) => e.occurrenceDate === "2027-01-11"));
  assert(!upcoming.some((e) => e.occurrenceDate === "2026-10-19"));
  assert.equal(upcoming.at(-1).date, "2026-12-29");
  assert.equal(
    expandEvents([series], { now: "2027-01-13T18:00:00Z", archive: true })[0]
      .date,
    "2027-01-12",
  );
});
