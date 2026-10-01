import { copy } from "./copy.js";
import {
  escape as x,
  localized,
  expandEvents,
  ZONE,
  ADDRESS,
} from "./domain.js";
import { local, origin } from "./security.js";
export const pathFor = (lang, path = "/") =>
  (lang === "es" ? "/es" : "") + path;
export const dateLabel = (iso, lang, options = {}) =>
  new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    timeZone: ZONE,
    month: "long",
    day: "numeric",
    ...options,
  }).format(new Date(iso));
export const timeLabel = (iso, lang) =>
  dateLabel(iso, lang, {
    month: undefined,
    day: undefined,
    hour: "numeric",
    minute: "2-digit",
  });
const brandMark = (className) =>
  `<img class="${className}" src="/assets/microcinema-mark.svg" alt="" aria-hidden="true" width="1078" height="985">`;
const paragraphs = (s) =>
  x(s)
    .split(/\n\s*\n/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
const detailList = (items) =>
  `<ul class="visit-details">${items.map((item) => `<li>${x(item)}</li>`).join("")}</ul>`;
export function field(
  name,
  label,
  {
    value = "",
    type = "text",
    required = false,
    max = 300,
    help = "",
    options = null,
    rows = 0,
    disabled = false,
  } = {},
) {
  const id = `field-${name}`,
    attrs = `id="${id}" name="${name}" ${required ? "required" : ""} ${disabled ? "readonly" : ""} ${help ? `aria-describedby="${id}-help"` : ""}`;
  const control = options
    ? `<select ${attrs}>${options.map(([v, l]) => `<option value="${x(v)}" ${v === value ? "selected" : ""}>${x(l)}</option>`).join("")}</select>`
    : rows
      ? `<textarea ${attrs} rows="${rows}" maxlength="${max}">${x(value)}</textarea>`
      : `<input ${attrs} type="${type}" value="${x(value)}" ${type === "file" ? 'accept="image/jpeg,image/png,image/webp"' : `maxlength="${max}"`} ${type === "email" ? 'autocomplete="email"' : ""}>`;
  return `<div class="field"><label for="${id}">${x(label)}${required ? ' <span aria-hidden="true">*</span>' : ""}</label>${control}${help ? `<small id="${id}-help">${x(help)}</small>` : ""}</div>`;
}
function challenge(env, action) {
  return local(env)
    ? ""
    : `<div class="cf-turnstile" data-sitekey="${x(env.TURNSTILE_SITE_KEY || "")}" data-action="${action}" data-size="flexible"></div>`;
}
export function shell({
  lang = "en",
  path = "/",
  title = "",
  description = "",
  body = "",
  env,
  script = "",
  image = "",
  privatePage = false,
}) {
  const t = copy[lang],
    p = pathFor.bind(null, lang),
    canonical = origin(env) + p(path);
  const other = lang === "en" ? "es" : "en";
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${x(title ? title + " · Dust Wave Microcinema" : "Dust Wave Microcinema · Albuquerque")}</title><meta name="description" content="${x(description || t.siteDescription)}"><meta name="theme-color" content="#fbfbf8"><link rel="icon" href="/assets/icon.svg?v=2" type="image/svg+xml"><link rel="stylesheet" href="/assets/site.css"><link rel="preload" href="/assets/departure-mono.woff2" as="font" type="font/woff2" crossorigin><link rel="canonical" href="${x(canonical)}"><link rel="alternate" hreflang="en" href="${x(origin(env) + pathFor("en", path))}"><link rel="alternate" hreflang="es" href="${x(origin(env) + pathFor("es", path))}"><meta property="og:title" content="${x(title || "Dust Wave Microcinema")}"><meta property="og:description" content="${x((description || t.siteDescription).slice(0, 300))}"><meta property="og:url" content="${x(canonical)}"><meta property="og:type" content="website"><meta property="og:image" content="${x(origin(env) + (image || "/assets/room.webp"))}">${privatePage || local(env) ? '<meta name="robots" content="noindex,nofollow">' : ""}</head><body class="${path.startsWith("/admin") ? "admin-page" : ""}"><a class="skip" href="#main">${t.skip}</a>
 ${local(env) ? `<div class="preview-banner">${t.localNote}</div>` : ""}
 <div class="page"><header class="site-header"><div class="topline"><a href="https://dustwave.xyz" class="parent-brand">DUST WAVE ↗</a><a href="${pathFor(other, path)}" lang="${other}" aria-label="${other === "es" ? "Ver en español" : "View in English"}">${other === "es" ? "ESPAÑOL" : "ENGLISH"}</a></div>
 <div class="masthead"><a href="${p("/")}" class="wordmark" aria-label="Dust Wave Microcinema">DUST WAVE<br>MICROCINEMA${brandMark("brand-symbol")}</a></div>
 <nav aria-label="${lang === "es" ? "Navegación principal" : "Main navigation"}">${[
   ["/", t.programme],
   ["/archive", t.archive],
   ["/visit", t.visit],
   ["/propose", t.propose],
 ]
   .map(
     ([href, label]) =>
       `<a ${path === href ? 'aria-current="page"' : ""} href="${p(href)}">${label}</a>`,
   )
   .join("")}</nav></header>
 <main id="main">${body}</main><footer><div class="footer-mark">${brandMark("footer-symbol")}</div><p><span class="mono">709 Haines Ave NW<br>Albuquerque, NM 87102</span></p><div><a href="mailto:info@dustwave.xyz">info@dustwave.xyz</a><br><a href="${p("/privacy")}">${t.privacy}</a></div></footer></div>
 ${script ? `<script type="module" src="/assets/${script}.js"></script>` : ""}${script && !local(env) ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : ""}</body></html>`;
}
export function cta(event, lang, { secondary = true } = {}) {
  const e = localized(event, lang),
    t = copy[lang];
  if (e.status === "cancelled")
    return `<span class="status cancelled">${t.cancelled}</span>`;
  if (e.endsAt < new Date().toISOString())
    return `<span class="status">${t.past}</span>`;
  const calendarLink = `${pathFor(lang, `/events/${e.slug}`)}.ics`;
  return e.mode === "walkin"
    ? `<a class="button" href="${calendarLink}">${t.calendar} <span aria-hidden="true">↓</span></a><span class="small-note">${t.walkin}</span>`
    : `<a class="button primary" href="${x(e.url)}" rel="noopener">${e.mode === "tickets" ? t.tickets : t.rsvp} <span aria-hidden="true">↗</span></a>${secondary ? `<a class="text-link" href="${calendarLink}">${t.calendar} ↓</a>` : ""}`;
}
function artwork(e, lang, index = 1) {
  return `<figure class="event-art ${e.image ? "" : "no-image"}">${e.image ? `<img src="${x(e.image)}" alt="${x(e.imageAlt || e.title)}" ${index > 1 ? 'loading="lazy"' : ""} width="1200" height="800">` : `<div class="art-placeholder" aria-hidden="true"><span>DW / ${String(index).padStart(2, "0")}</span>${brandMark("placeholder-symbol")}<span>DUST WAVE MICROCINEMA</span></div>`}<figcaption><span>FIG. ${String(index).padStart(2, "0")}</span><span>DUST WAVE MICROCINEMA</span></figcaption></figure>`;
}
function eventRow(event, lang, index) {
  const e = localized(event, lang),
    t = copy[lang],
    url = pathFor(lang, `/events/${e.slug}`);
  return `<article class="event-row"><div class="event-number mono">${String(index).padStart(2, "0")}</div><div class="event-date mono"><time datetime="${e.startsAt}">${x(dateLabel(e.startsAt, lang, { month: "short", day: "2-digit" }))}</time><span>${timeLabel(e.startsAt, lang)}</span></div><div class="event-info"><h3><a href="${url}">${x(e.title)}</a></h3><p>${x(e.details || e.description.slice(0, 160))}</p></div><div class="row-action"><span class="mono">${e.status === "cancelled" ? t.cancelled : x(e.price || (e.mode === "walkin" ? t.walkin : ""))}</span><a href="${url}" aria-label="${x(t.more + ": " + e.title)}">${t.more} ↗</a></div></article>`;
}
export function programme(events, lang, env, archive = false) {
  const t = copy[lang];
  const list = expandEvents(events, { archive });
  const first = list[0] && localized(list[0], lang);
  const remaining = archive ? list : list.slice(1);
  let body = archive
    ? `<section class="section-heading"><span class="mono">${lang === "es" ? "EL ARCHIVO" : "THE ARCHIVE"}</span><h1>${t.archive}</h1></section>`
    : `<h1 class="visually-hidden">${t.programme}</h1>`;
  if (first && !archive)
    body += `<section class="featured">${artwork(first, lang)}<div class="feature-copy"><span class="eyebrow">${t.next}</span><p class="feature-date mono">${dateLabel(first.startsAt, lang, { weekday: "short" })} <span> / </span> ${timeLabel(first.startsAt, lang)}</p><h2><a href="${pathFor(lang, `/events/${first.slug}`)}">${x(first.title)}</a></h2><p class="film-details">${x(first.details)}</p><p class="feature-description">${x(first.description.length > 320 ? first.description.slice(0, 317) + "…" : first.description)}</p><p class="admission-label mono">${x(first.price)}</p><div class="actions">${cta(first, lang, { secondary: false })}</div><a class="text-link" href="${pathFor(lang, `/events/${first.slug}`)}">${t.readMore} →</a></div></section>`;
  if (remaining.length)
    body += `<section class="schedule" aria-label="${t.programme}"><div class="list-heading mono"><span>${archive ? t.archive : t.programme}</span><span>${remaining.length} ${lang === "es" ? (remaining.length === 1 ? "EVENTO" : "EVENTOS") : remaining.length === 1 ? "EVENT" : "EVENTS"} / ${ZONE}</span></div>${remaining.map((e, i) => eventRow(e, lang, i + 1)).join("")}</section>`;
  else if (!list.length)
    body += `<section class="empty-state">${brandMark("empty-symbol")}<div><h2>${archive ? t.archiveEmpty : t.empty}</h2><p>${t.emptyBody}</p><a class="button" href="${pathFor(lang, "/propose")}">${t.propose} ↗</a></div></section>`;
  body += `<aside class="venue-note"><div class="mono">${x(t.venueNote).replace("\n", "<br>")}</div><a class="text-link" href="${pathFor(lang, "/visit")}">${t.visit} ↗</a></aside>`;
  return shell({
    lang,
    path: archive ? "/archive" : "/",
    title: archive ? t.archive : "",
    body,
    env,
  });
}
export function eventPage(event, lang, env) {
  const e = localized(event, lang),
    t = copy[lang];
  return shell({
    lang,
    path: `/events/${e.slug}`,
    title: e.title,
    description: e.description.slice(0, 250),
    image: e.image,
    env,
    body: `<a class="back-link mono" href="${pathFor(lang, e.endsAt < new Date().toISOString() ? "/archive" : "/")}">← ${t.back}</a><article class="event-detail"><header><p class="eyebrow">${dateLabel(e.startsAt, lang, { weekday: "long", year: "numeric" })}</p><h1>${x(e.title)}</h1><p class="film-details">${x(e.details)}</p></header><div class="detail-grid">${artwork(e, lang)}<aside class="event-facts"><dl><dt>${t.when}</dt><dd>${dateLabel(e.startsAt, lang)}<br>${timeLabel(e.startsAt, lang)}–${timeLabel(e.endsAt, lang)}${e.date !== e.endDate ? `<br>${dateLabel(e.endsAt, lang)}` : ""}</dd><dt>${t.where}</dt><dd>Dust Wave Microcinema<br>${ADDRESS}</dd><dt>${t.admission}</dt><dd>${x(e.price || (e.mode === "tickets" ? t.tickets : e.mode === "rsvp" ? t.rsvp : t.walkin))}</dd></dl><div class="actions">${cta(e, lang)}</div><p class="small-note">${t.timezone}</p></aside></div><div class="prose event-prose">${paragraphs(e.description)}${e.infoUrl ? `<p><a class="text-link" href="${x(e.infoUrl)}" rel="noopener">${x(e.infoLabel || t.moreInfo)} ↗</a></p>` : ""}</div></article>`,
  });
}
export function visitPage(lang, env) {
  const t = copy[lang];
  return shell({
    lang,
    path: "/visit",
    title: t.visit,
    env,
    body: `<h1 class="visually-hidden">${t.visit}</h1><div class="visit-grid"><figure class="visit-figure"><div class="photo-frame"><img class="room-photo" src="/assets/room.webp" alt="${lang === "es" ? "La sala del Microcine Dust Wave" : "The Dust Wave Microcinema screening room"}" width="1200" height="800"></div><figcaption><span>FIG. 01</span><span>DUST WAVE HQ</span></figcaption></figure><div class="prose"><h2 class="eyebrow">${t.room}</h2>${detailList([`${t.roomLocation} ${ADDRESS}.`, ...t.roomDetails])}<a class="button" href="https://maps.google.com/?q=709+Haines+Ave+NW+Albuquerque+NM+87102" rel="noopener">${t.directions} ↗</a><p>${t.access} <a href="mailto:info@dustwave.xyz">info@dustwave.xyz</a>.</p></div></div><div class="visit-grid parking"><div class="prose"><h2 class="eyebrow">${t.parking}</h2>${detailList(t.parkingDetails)}</div><figure class="visit-figure"><div class="photo-frame"><img src="/assets/parking.webp" alt="${lang === "es" ? "Mapa: no estacionar frente al estudio; estacionamiento al otro lado de Haines y en las calles 7 y 8." : "Parking map: keep the studio curb clear; park across Haines or on 7th and 8th Streets."}" loading="lazy" width="1000" height="800"></div><figcaption><span>FIG. 02</span><span>${t.parking}</span></figcaption></figure></div>`,
  });
}
export function proposalPage(lang, env) {
  const t = copy[lang];
  return shell({
    lang,
    path: "/propose",
    title: t.propose,
    env,
    script: "public",
    body: `<section class="form-layout"><div class="form-intro"><span class="eyebrow">${t.propose}</span><h1>${t.proposeTitle}</h1><p>${t.proposeBody}</p><p class="small-note">${t.private}</p></div><form id="proposal-form"><p class="small-note">${t.requiredHint}</p>${field("title", t.title, { required: true, max: 160 })}${field("description", t.description, { required: true, rows: 6, max: 6000 })}<div class="form-grid">${field("date", t.date, { required: true, type: "date" })}${field("time", t.time, { required: true, type: "time" })}</div>${field("name", t.name, { required: true, max: 100 })}${field("email", t.email, { required: true, type: "email", max: 254 })}<div class="honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>${challenge(env, "proposal")}<p class="form-status" role="status"></p><button class="button primary" type="submit">${t.send} ↗</button><noscript><p>${lang === "es" ? "Activa JavaScript para enviar este formulario, o escribe a" : "Enable JavaScript to submit this form, or email"} <a href="mailto:info@dustwave.xyz">info@dustwave.xyz</a>.</p></noscript></form></section>`,
  });
}
export function adminPage(lang, env) {
  const t = copy[lang];
  return shell({
    lang,
    path: "/admin/",
    title: t.admin,
    env,
    privatePage: true,
    script: "admin",
    body: `<section id="login-panel" class="login-panel"><span class="eyebrow">DUST WAVE MICROCINEMA / ${t.admin}</span><h1>${t.signin}</h1><p>${t.signinBody}</p><form id="login-form">${field("email", t.email, { required: true, type: "email", max: 254 })}${challenge(env, "login")}<button class="button primary" type="submit">${t.sendLink} ↗</button></form><p id="login-status" role="status">${t.sessionLoad}</p><noscript>JavaScript ${lang === "es" ? "es necesario para administrar eventos." : "is required to manage events."}</noscript></section><section id="dashboard" hidden><div class="admin-toolbar"><h1>${t.events}</h1><div class="actions"><button class="button primary" id="add-event">+ ${t.add}</button><button class="button" id="logout">${t.logout}</button></div></div><p id="admin-status" role="status"></p><section id="editor" hidden></section><div id="event-list"></div><details id="removed-section"><summary>${t.removed}</summary><div id="removed-list"></div></details><section class="proposals-section"><h2>${t.proposals}</h2><div id="proposal-list"></div></section></section>`,
  });
}
export function privacyPage(lang, env) {
  const t = copy[lang];
  return shell({
    lang,
    path: "/privacy",
    title: t.privacy,
    env,
    body: `<section class="section-heading"><h1>${t.privacy}</h1></section><div class="prose narrow"><p>${x(t.privacyText).replace("info@dustwave.xyz", '<a href="mailto:info@dustwave.xyz">info@dustwave.xyz</a>')}</p><p>${lang === "es" ? "Los datos del acceso de administración se guardan en cookies de sesión. Los formularios usan Cloudflare Turnstile para prevenir el abuso." : "Admin sign-in uses session cookies. Forms use Cloudflare Turnstile to prevent abuse."}</p><a href="https://www.cloudflare.com/privacypolicy/">Cloudflare · ${t.privacy}</a></div>`,
  });
}
export function notFound(lang, env) {
  const t = copy[lang];
  return shell({
    lang,
    path: "/404",
    title: t.notFound,
    env,
    body: `<section class="section-heading"><span class="mono">404</span><h1>${t.notFound}</h1><p>${t.notFoundBody}</p><a class="button" href="${pathFor(lang, "/")}">${t.back} →</a></section>`,
  });
}
