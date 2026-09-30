import { AdminApiClient } from "@dustwave/admin-shell/api-client";
import { mountUnsavedChangesGuard } from "@dustwave/admin-shell/unsaved-changes";
import { copy } from "./copy.js";
import { mountConfirmationDialog } from "@dustwave/admin-shell/confirmation-dialog";
import { field } from "./render.js";
import { escape as x } from "./domain.js";
const lang = document.documentElement.lang,
  t = copy[lang],
  prefix = lang === "es" ? "/es" : "";
const api = new AdminApiClient({ baseUrl: "/api" }),
  $ = (s) => document.querySelector(s);
const login = $("#login-panel"),
  dashboard = $("#dashboard"),
  editor = $("#editor");
let events = [],
  proposals = [],
  dirty = false,
  busy = false,
  editing = null;
const guard = mountUnsavedChangesGuard({
  hasUnsavedChanges: () => dirty || busy,
});
const message = (error, target = "#admin-status") => {
  $(target).textContent = t[error.code || error.message] || t.genericError;
};
const confirmation = mountConfirmationDialog(document.body, {
  cancelLabel: lang === "es" ? "Cancelar" : "Cancel",
  confirmLabel: lang === "es" ? "Confirmar" : "Confirm",
});
const ask = async (description, confirmLabel) => {
  const result = await confirmation.open({
    title: confirmLabel || t.close,
    description,
    confirmLabel,
  });
  return result.confirmed;
};
const confirmMove = async () =>
  !busy &&
  (!dirty ||
    (await ask(
      t.discard,
      lang === "es" ? "Descartar cambios" : "Discard changes",
    )));
function showDashboard(session) {
  api.setCsrfToken(session.csrf);
  login.hidden = true;
  dashboard.hidden = false;
}
async function refresh() {
  const [eventData, proposalData] = await Promise.all([
    api.request("/admin/events"),
    api.request("/admin/proposals"),
  ]);
  events = eventData.events;
  proposals = proposalData.proposals;
  renderLists();
}
function dateText(e) {
  return new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "en-US", {
    timeZone: "America/Denver",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(e.startsAt));
}
function renderLists() {
  const row = (e) =>
    `<article class="admin-row"><div><span class="status">${x(t[e.status] || e.status)}</span><h3>${x(e.title)}</h3><p class="mono">${x(dateText(e))}</p></div><div class="actions">${e.status === "removed" ? `<button class="button" data-restore="${e.id}">${t.restore}</button>` : `<button class="button" data-edit="${e.id}">${t.edit}</button><button class="button danger" data-remove="${e.id}">${t.remove}</button>${e.status === "published" || e.status === "cancelled" ? `<a class="text-link" href="${prefix}/events/${e.slug}" target="_blank" rel="noopener">${t.preview} ↗</a>` : ""}`}</div></article>`;
  $("#event-list").innerHTML =
    events
      .filter((e) => e.status !== "removed")
      .map(row)
      .join("") || `<p class="empty-small">${t.noEvents}</p>`;
  $("#removed-list").innerHTML = events
    .filter((e) => e.status === "removed")
    .map(row)
    .join("");
  $("#removed-section").hidden = !events.some((e) => e.status === "removed");
  $("#proposal-list").innerHTML =
    proposals
      .map(
        (p) =>
          `<article class="proposal-row"><div><span class="status">${t.pending}</span><h3>${x(p.title)}</h3><p class="mono">${x(p.date)} / ${x(p.time)}</p><p class="proposal-description">${x(p.description)}</p><p>${x(p.name)} · <a href="mailto:${x(p.email)}">${x(p.email)}</a></p></div><div class="actions"><button class="button" data-proposal="${p.id}">${t.makeDraft}</button><button class="button" data-dismiss="${p.id}">${t.dismiss}</button></div></article>`,
      )
      .join("") || `<p class="empty-small">${t.noProposals}</p>`;
}
function endAfter(date, time) {
  if (!date || !time) return { endDate: "", endTime: "" };
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCHours(d.getUTCHours() + 2);
  return {
    endDate: d.toISOString().slice(0, 10),
    endTime: d.toISOString().slice(11, 16),
  };
}
const slugFromTitle = (title) =>
  title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
async function openEditor(event = null, proposal = null) {
  if (!(await confirmMove())) return;
  const e = event || {
    id: proposal?.id || crypto.randomUUID(),
    revision: 0,
    status: "draft",
    mode: "walkin",
    title: proposal?.title || "",
    slug: slugFromTitle(proposal?.title || ""),
    description: proposal?.description || "",
    date: proposal?.date || "",
    time: proposal?.time || "",
    ...endAfter(proposal?.date, proposal?.time),
    image: "",
  };
  editing = { ...e, proposalId: proposal?.id };
  dirty = false;
  const f = (name, label, options = {}) =>
    field(name, label, { value: e[name] || "", ...options });
  editor.innerHTML = `<div class="editor-heading"><h2 tabindex="-1">${event ? t.editEvent : t.newEvent}</h2><button type="button" class="button" id="close-editor">${t.close} ×</button></div><form id="event-form"><p class="small-note">${t.requiredHint} ${t.timezone}</p><div class="form-grid">${f("title", t.title + " · " + t.english, { required: true, max: 160 })}${f("slug", t.slug, { required: true, max: 100, help: t.slugHelp, disabled: !!event })}</div>${f("description", t.description + " · " + t.english, { required: true, rows: 6, max: 12000 })}${f("details", t.details, { max: 400, help: t.detailsHelp })}<div class="form-grid four">${f("date", t.date, { required: true, type: "date" })}${f("time", t.time, { required: true, type: "time" })}${f("endDate", t.endDate, { required: true, type: "date" })}${f("endTime", t.endTime, { required: true, type: "time" })}</div><div class="form-grid">${f(
    "mode",
    t.mode,
    {
      options: [
        ["walkin", t.calendar + " / " + t.walkin],
        ["tickets", t.tickets],
        ["rsvp", t.rsvp],
      ],
    },
  )}${f("price", t.price, { help: t.priceHelp, max: 100 })}</div><div id="url-field">${f("url", t.link, { type: "url", max: 2048 })}</div><fieldset><legend>${t.artwork}</legend>${f("upload", t.artwork, { type: "file", help: t.artworkHelp })}<input type="hidden" name="image" value="${x(e.image)}"><img id="art-preview" class="art-preview" ${e.image ? `src="${x(e.image)}"` : "hidden"} alt=""><button class="button" type="button" id="remove-image" ${e.image ? "" : "hidden"}>${t.removeImage}</button>${f("imageAlt", t.alt, { max: 250 })}<p id="upload-status" role="status"></p></fieldset><details class="translation"><summary>${t.spanish}</summary><p class="small-note">${t.spanishHelp}</p>${f("titleEs", t.title + " · " + t.spanish, { max: 160 })}${f("descriptionEs", t.description + " · " + t.spanish, { rows: 6, max: 12000 })}${f("detailsEs", t.details + " · " + t.spanish, { max: 400 })}${f("priceEs", t.price + " · " + t.spanish, { max: 100 })}${f("imageAltEs", t.alt + " · " + t.spanish, { max: 250 })}</details>${f(
    "status",
    t.status,
    {
      options: [
        ["draft", t.draft],
        ["published", t.published],
        ["cancelled", t.cancelled],
      ],
    },
  )}<p id="editor-status" role="status" class="form-status"></p><div class="editor-save"><button class="button primary" type="submit">${t.save} ↗</button><span class="small-note">${t.timezone}</span></div></form>`;
  editor.hidden = false;
  editor.querySelector("h2").focus();
  editor.scrollIntoView({ block: "start", behavior: "smooth" });
  const form = $("#event-form");
  const syncMode = () => {
    const needsLink = form.elements.mode.value !== "walkin";
    $("#url-field").hidden = !needsLink;
    form.elements.url.required = needsLink;
  };
  syncMode();
  form.addEventListener("input", () => {
    dirty = true;
  });
  form.elements.mode.addEventListener("change", syncMode);
  if (!event) {
    let customSlug = false;
    form.elements.slug.addEventListener("input", () => {
      customSlug = true;
    });
    form.elements.title.addEventListener("input", () => {
      if (!customSlug)
        form.elements.slug.value = slugFromTitle(form.elements.title.value);
    });
  }
  form.elements.date.addEventListener("change", () => {
    if (!form.elements.endDate.value)
      form.elements.endDate.value = form.elements.date.value;
  });
  $("#close-editor").onclick = async () => {
    if (await confirmMove()) {
      editor.hidden = true;
      editor.replaceChildren();
      dirty = false;
      editing = null;
      $("#add-event").focus();
    }
  };
  $("#remove-image").onclick = () => {
    form.elements.image.value = "";
    $("#art-preview").hidden = true;
    $("#remove-image").hidden = true;
    dirty = true;
  };
  form.elements.upload.addEventListener("change", async () => {
    const file = form.elements.upload.files[0];
    if (!file) return;
    busy = true;
    form.querySelector("[type=submit]").disabled = true;
    $("#close-editor").disabled = true;
    $("#upload-status").textContent = t.uploading;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("file_too_large");
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
        throw new Error("invalid_image");
      const bitmap = await createImageBitmap(file);
      const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * ratio);
      canvas.height = Math.round(bitmap.height * ratio);
      canvas
        .getContext("2d")
        .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.85),
      );
      if (!blob || blob.type !== "image/webp") throw new Error("invalid_image");
      const result = await api.request("/admin/images", {
        method: "POST",
        body: blob,
        headers: { "Content-Type": "image/webp" },
      });
      form.elements.image.value = result.path;
      $("#art-preview").src = result.path;
      $("#art-preview").hidden = false;
      $("#remove-image").hidden = false;
      $("#upload-status").textContent = "";
      dirty = true;
    } catch (error) {
      message(error, "#upload-status");
    } finally {
      busy = false;
      form.querySelector("[type=submit]").disabled = false;
      $("#close-editor").disabled = false;
      form.elements.upload.value = "";
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    $("#editor-status").textContent = "";
    const data = { ...editing, ...Object.fromEntries(new FormData(form)) };
    delete data.upload;
    try {
      const result = await api.request("/admin/events", {
        method: "POST",
        body: data,
      });
      editing = result.event;
      dirty = false;
      editor.hidden = true;
      editor.replaceChildren();
      $("#admin-status").textContent = t.saved;
      await refresh();
      $("#add-event").focus();
    } catch (error) {
      if (document.querySelector("#editor-status"))
        message(error, "#editor-status");
      else message(error);
    } finally {
      busy = false;
      if (button.isConnected) button.disabled = false;
    }
  });
}
$("#add-event").onclick = () => openEditor();
dashboard.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { edit, remove, restore, proposal, dismiss } = button.dataset;
  if (edit) {
    openEditor(events.find((e) => e.id === edit));
    return;
  }
  if (proposal) {
    openEditor(
      null,
      proposals.find((e) => e.id === proposal),
    );
    return;
  }
  if (!(remove || restore || dismiss) || !(await confirmMove())) return;
  if (remove && !(await ask(t.confirmDelete, t.remove))) return;
  if (dismiss && !(await ask(t.proposalDismiss, t.dismiss))) return;
  busy = true;
  button.disabled = true;
  try {
    if (dismiss)
      await api.request("/admin/proposals/dismiss", {
        method: "POST",
        body: { id: dismiss },
      });
    else {
      const record = events.find((e) => e.id === (remove || restore));
      await api.request("/admin/events/" + (remove ? "remove" : "restore"), {
        method: "POST",
        body: { id: record.id, revision: record.revision },
      });
    }
    dirty = false;
    editor.hidden = true;
    editor.replaceChildren();
    await refresh();
  } catch (error) {
    message(error);
  } finally {
    busy = false;
    button.disabled = false;
  }
});
$("#logout").onclick = async () => {
  if (!(await confirmMove())) return;
  try {
    await api.request("/logout", { method: "POST", body: {} });
    dirty = false;
    location.href = prefix + "/admin/";
  } catch (error) {
    message(error);
  }
};
$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget,
    button = form.querySelector("button");
  button.disabled = true;
  $("#login-status").textContent = "";
  try {
    const data = Object.fromEntries(new FormData(form));
    const result = await api.request("/login", {
      method: "POST",
      body: { ...data, lang, token: data["cf-turnstile-response"] || "" },
      csrf: false,
    });
    $("#login-status").textContent = t.linkSent;
    if (result.localLoginUrl) {
      const link = Object.assign(document.createElement("a"), {
        href: result.localLoginUrl,
        textContent: t.localLink,
        className: "button",
      });
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        try {
          const session = await api.request("/session", {
            method: "POST",
            body: { token: new URL(result.localLoginUrl).hash.slice(7) },
            csrf: false,
          });
          showDashboard(session);
          await refresh();
        } catch (error) {
          message(error, "#login-status");
        }
      });
      $("#login-status").append(document.createElement("br"), link);
    }
  } catch (error) {
    message(error, "#login-status");
  } finally {
    button.disabled = false;
    window.turnstile?.reset();
  }
});
async function initialize() {
  try {
    let session;
    if (location.hash.startsWith("#token=")) {
      const token = location.hash.slice(7);
      history.replaceState(null, "", location.pathname);
      session = await api.request("/session", {
        method: "POST",
        body: { token },
        csrf: false,
      });
    } else session = await api.request("/session");
    showDashboard(session);
    await refresh();
  } catch (error) {
    if (error.code === "unauthorized") $("#login-status").textContent = "";
    else message(error, dashboard.hidden ? "#login-status" : "#admin-status");
  }
}
await initialize();
