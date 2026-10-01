import {
  dateAtTimeInTimeZone,
  getTimeZoneParts,
} from "@dustwave/worker-core/date-time";
export const ZONE = "America/Denver";
export const ADDRESS = "709 Haines Avenue NW, Albuquerque, NM 87102";
export function fail(code, status = 400) {
  throw Object.assign(new Error(code), { code, status });
}
export function text(value, max = 300, required = false) {
  if (typeof value !== "string") {
    if (required) fail("required");
    return "";
  }
  const s = value.trim();
  if (
    s.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(s)
  )
    fail("invalid_text");
  if (required && !s) fail("required");
  return s;
}
export function email(value) {
  const s = text(value, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail("invalid_email");
  return s;
}
export function localInstant(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    fail("invalid_date");
  const [h, m] = time.split(":").map(Number);
  if (h > 23 || m > 59) fail("invalid_date");
  const d = dateAtTimeInTimeZone(date, ZONE, h, m);
  if (!Number.isFinite(d.getTime())) fail("invalid_date");
  const p = getTimeZoneParts(d, ZONE);
  const parts = date.split("-").map(Number);
  if (
    p.year !== parts[0] ||
    p.month !== parts[1] ||
    p.day !== parts[2] ||
    p.hour !== h ||
    p.minute !== m
  )
    fail("invalid_date");
  // A repeated fall-back hour has two valid instants. Require an unambiguous time.
  const later = getTimeZoneParts(new Date(+d + 3600000), ZONE);
  const earlier = getTimeZoneParts(new Date(+d - 3600000), ZONE);
  if (
    [later, earlier].some(
      (v) =>
        v.year === p.year &&
        v.month === p.month &&
        v.day === p.day &&
        v.hour === h &&
        v.minute === m,
    )
  )
    fail("ambiguous_time");
  return d.toISOString();
}
export function externalUrl(value, mode) {
  const s = text(value, 2048, mode !== "walkin");
  if (!s) return "";
  let u;
  try {
    u = new URL(s);
  } catch {
    fail("invalid_url");
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    !u.hostname.includes(".")
  )
    fail("invalid_url");
  if (mode === "tickets" && u.hostname !== "shop.dustwave.xyz")
    fail("shop_url_required");
  return u.href;
}
export function validateEvent(input, old = null) {
  const id = old?.id || crypto.randomUUID();
  const slug = text(input.slug, 100, true);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail("invalid_slug");
  if (old && slug !== old.slug) fail("slug_locked");
  const mode = input.mode;
  if (!["walkin", "tickets", "rsvp"].includes(mode)) fail("invalid_mode");
  const status = input.status;
  if (!["draft", "published", "cancelled"].includes(status))
    fail("invalid_status");
  const date = text(input.date, 10, true),
    time = text(input.time, 5, true),
    endTime = text(input.endTime, 5, true);
  const endDate = text(input.endDate, 10) || date;
  const startsAt = localInstant(date, time),
    endsAt = localInstant(endDate, endTime);
  if (
    endsAt <= startsAt ||
    Date.parse(endsAt) - Date.parse(startsAt) > 7 * 86400000
  )
    fail("invalid_end_time");
  const image = text(input.image, 200);
  if (
    image &&
    !/^\/media\/[a-f0-9-]{36}\.webp$/.test(image) &&
    !/^\/assets\/(room\.(?:jpg|webp)|sample-[a-z]+\.svg)$/.test(image)
  )
    fail("invalid_image");
  const event = {
    id,
    slug,
    status,
    mode,
    date,
    time,
    endDate,
    endTime,
    startsAt,
    endsAt,
    title: text(input.title, 160, true),
    titleEs: text(input.titleEs, 160),
    description: text(input.description, 12000, true),
    descriptionEs: text(input.descriptionEs, 12000),
    details: text(input.details, 400),
    detailsEs: text(input.detailsEs, 400),
    price: text(input.price, 100),
    priceEs: text(input.priceEs, 100),
    image,
    imageAlt: text(input.imageAlt, 250),
    imageAltEs: text(input.imageAltEs, 250),
    url: mode === "walkin" ? "" : externalUrl(input.url, mode),
    infoUrl: externalUrl(input.infoUrl, "walkin"),
    infoUrlEs: externalUrl(input.infoUrlEs, "walkin"),
    infoLabel: text(input.infoLabel, 80),
    infoLabelEs: text(input.infoLabelEs, 80),
    updatedAt: new Date().toISOString(),
    revision: (old?.revision || 0) + 1,
  };
  return { ...event, ...validateRecurrence(input, event, old) };
}

const DAY = 86400000;
const repeatDays = { weekly: 7, fortnightly: 14 };
export const isSeries = (event) => Object.hasOwn(repeatDays, event.repeat);
const dayNumber = (date) => Date.parse(`${date}T12:00:00Z`) / DAY;
const addDays = (date, days) =>
  new Date((dayNumber(date) + days) * DAY).toISOString().slice(0, 10);
export function windowEnd(now = new Date()) {
  const { year, month, day } = getTimeZoneParts(new Date(now), ZONE);
  const lastDay = new Date(Date.UTC(year, month + 3, 0)).getUTCDate();
  return new Date(Date.UTC(year, month + 2, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}
function scheduledDate(event, date) {
  if (!isSeries(event) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const distance = dayNumber(date) - dayNumber(event.date);
  return (
    Number.isFinite(distance) &&
    distance >= 0 &&
    addDays(event.date, distance) === date &&
    distance % repeatDays[event.repeat] === 0 &&
    (!event.repeatUntil || date <= event.repeatUntil)
  );
}
function validateRecurrence(input, event, old) {
  const repeat = input.repeat || "none";
  if (repeat !== "none" && !isSeries({ repeat })) fail("invalid_repeat");
  if (isSeries(old || {}) && (repeat !== old.repeat || event.date !== old.date))
    fail("series_locked");
  if (repeat === "none") return { repeat, repeatUntil: "", exceptions: [] };
  // Bound expansion and avoid series that eventually land in a DST gap/fold.
  if (event.date < "2000-01-01" || event.date > "2100-12-31")
    fail("invalid_date");
  for (const [date, time] of [
    [event.date, event.time],
    [event.endDate, event.endTime],
  ]) {
    if (
      new Date(`${date}T12:00:00Z`).getUTCDay() === 0 &&
      /^(01|02):/.test(time)
    )
      fail("recurrence_time");
  }
  const repeatUntil = text(input.repeatUntil, 10);
  if (repeatUntil) {
    localInstant(repeatUntil, "12:00");
    if (repeatUntil < event.date || repeatUntil > "2100-12-31")
      fail("invalid_repeat_end");
  }
  const series = { ...event, repeat, repeatUntil };
  if (input.exceptions != null && !Array.isArray(input.exceptions))
    fail("invalid_exception");
  const exceptions = input.exceptions || [];
  if (exceptions.length > 100) fail("invalid_exception");
  const seen = new Set();
  const normalized = exceptions.map((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !scheduledDate({ ...series, repeatUntil: "" }, item.on) ||
      seen.has(item.on)
    )
      fail("invalid_exception");
    localInstant(item.on, "12:00");
    seen.add(item.on);
    const date = text(item.date, 10, true),
      time = text(item.time, 5, true),
      endDate = text(item.endDate, 10, true),
      endTime = text(item.endTime, 5, true);
    const startsAt = localInstant(date, time),
      endsAt = localInstant(endDate, endTime);
    if (
      endsAt <= startsAt ||
      Date.parse(endsAt) - Date.parse(startsAt) > 7 * DAY
    )
      fail("invalid_end_time");
    if (typeof item.cancelled !== "boolean") fail("invalid_exception");
    return {
      on: item.on,
      date,
      time,
      endDate,
      endTime,
      cancelled: item.cancelled,
    };
  });
  return { repeat, repeatUntil, exceptions: normalized };
}
export function occurrence(event, on) {
  if (!scheduledDate(event, on)) return null;
  const exception = event.exceptions?.find((item) => item.on === on);
  const date = exception?.date || on;
  const time = exception?.time || event.time;
  const endDate =
    exception?.endDate ||
    addDays(on, dayNumber(event.endDate) - dayNumber(event.date));
  const endTime = exception?.endTime || event.endTime;
  return {
    ...event,
    date,
    time,
    endDate,
    endTime,
    startsAt: localInstant(date, time),
    endsAt: localInstant(endDate, endTime),
    id: `${event.id}-${on}`,
    slug: `${event.slug}/${on}`,
    seriesId: event.id,
    occurrenceDate: on,
    status: exception?.cancelled ? "cancelled" : event.status,
  };
}
export function expandEvents(
  events,
  { now = new Date(), archive = false } = {},
) {
  const stamp = new Date(now).toISOString(),
    horizon = windowEnd(now);
  const instances = events.flatMap((event) => {
    if (!isSeries(event)) return [event];
    // One saved series; dates are projected on every request, with no cron or duplicate rows.
    const dates = new Set();
    const step = repeatDays[event.repeat];
    const today = new Date(now).toISOString().slice(0, 10);
    const startIndex = archive
      ? 0
      : Math.max(
          0,
          Math.floor((dayNumber(today) - dayNumber(event.date) - 8) / step),
        );
    const end =
      event.repeatUntil && event.repeatUntil < horizon
        ? event.repeatUntil
        : horizon;
    for (
      let date = addDays(event.date, startIndex * step);
      date <= end;
      date = addDays(date, step)
    )
      dates.add(date);
    for (const exception of event.exceptions || []) dates.add(exception.on);
    return [...dates]
      .map((date) => occurrence(event, date))
      .filter(Boolean)
      .filter((item) => item.date <= horizon);
  });
  return instances
    .filter((event) => (archive ? event.endsAt < stamp : event.endsAt >= stamp))
    .sort((a, b) =>
      archive
        ? b.startsAt.localeCompare(a.startsAt)
        : a.startsAt.localeCompare(b.startsAt),
    );
}
export function localized(event, lang) {
  return {
    ...event,
    title: (lang === "es" && event.titleEs) || event.title,
    description: (lang === "es" && event.descriptionEs) || event.description,
    details: (lang === "es" && event.detailsEs) || event.details,
    price: (lang === "es" && event.priceEs) || event.price,
    imageAlt: (lang === "es" && event.imageAltEs) || event.imageAlt,
    infoUrl: (lang === "es" && event.infoUrlEs) || event.infoUrl,
    infoLabel: (lang === "es" && event.infoLabelEs) || event.infoLabel,
  };
}
export function escape(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
const icsText = (s) =>
  String(s || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
function fold(line) {
  let out = "",
    chunk = "",
    bytes = 0;
  for (const c of line) {
    const n = new TextEncoder().encode(c).length;
    if (bytes + n > 75) {
      out += chunk + "\r\n";
      chunk = " ";
      bytes = 1;
    }
    chunk += c;
    bytes += n;
  }
  return out + chunk;
}
export function calendar(event, origin, lang = "en") {
  const e = localized(event, lang),
    stamp = (s) =>
      new Date(s)
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z");
  return (
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Dust Wave//Microcinema//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${e.id}@dustwavemicrocinema.com`,
      `DTSTAMP:${stamp(e.updatedAt)}`,
      `LAST-MODIFIED:${stamp(e.updatedAt)}`,
      `SEQUENCE:${e.revision}`,
      `DTSTART:${stamp(e.startsAt)}`,
      `DTEND:${stamp(e.endsAt)}`,
      `SUMMARY:${icsText(e.title)}`,
      `DESCRIPTION:${icsText(e.description)}`,
      `LOCATION:${icsText(ADDRESS)}`,
      `URL:${origin}${lang === "es" ? "/es" : ""}/events/${e.slug}`,
      `STATUS:${e.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n"
  );
}
