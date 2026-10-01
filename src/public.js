import { copy } from "./copy.js";
const lang = document.documentElement.lang,
  t = copy[lang],
  form = document.querySelector("#proposal-form");
let id = crypto.randomUUID(),
  previewUrl = "";
const preview = form?.querySelector("#proposal-image-preview");
form?.elements.image.addEventListener("change", () => {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const file = form.elements.image.files[0];
  preview.hidden = !file;
  if (file) {
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
  }
});
// Editing after a failed/uncertain submission starts a new reference. An
// unchanged retry retains its reference and cannot create a second notification.
let attempted = false;
form?.addEventListener("input", () => {
  if (attempted) {
    id = crypto.randomUUID();
    attempted = false;
  }
});
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type=submit]"),
    status = form.querySelector("[role=status]");
  button.disabled = true;
  status.textContent = "";
  try {
    const values = new FormData(form);
    const file = form.elements.image.files[0];
    if (file && file.size > 5 * 1024 * 1024) throw new Error("file_too_large");
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("invalid_image");
    values.set("id", id);
    values.set("lang", lang);
    values.set("token", values.get("cf-turnstile-response") || "");
    values.delete("cf-turnstile-response");
    attempted = true;
    form.setAttribute("aria-busy", "true");
    for (const control of form.elements) control.disabled = true;
    const response = await fetch("/api/proposals", {
      method: "POST",
      body: values,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    window.turnstile?.remove();
    form.replaceChildren(
      Object.assign(document.createElement("p"), {
        textContent: t.sent,
        className: "success-message",
      }),
      Object.assign(document.createElement("p"), {
        textContent: `${t.reference}: ${data.id}`,
        className: "small-note",
      }),
    );
    form.removeAttribute("aria-busy");
    form.setAttribute("role", "status");
    form.tabIndex = -1;
    form.focus();
  } catch (error) {
    status.textContent = t[error.message] || t.genericError;
    window.turnstile?.reset();
    form.removeAttribute("aria-busy");
    for (const control of form.elements) control.disabled = false;
  }
});
