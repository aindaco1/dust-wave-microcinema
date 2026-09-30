import { copy } from "./copy.js";
const lang = document.documentElement.lang,
  t = copy[lang],
  form = document.querySelector("#proposal-form");
const id = crypto.randomUUID();
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button[type=submit]"),
    status = form.querySelector("[role=status]");
  button.disabled = true;
  status.textContent = "";
  try {
    const values = Object.fromEntries(new FormData(form));
    const response = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        id,
        lang,
        token: values["cf-turnstile-response"] || "",
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    form.replaceChildren(
      Object.assign(document.createElement("p"), {
        textContent: t.sent,
        className: "success-message",
      }),
    );
    form.setAttribute("role", "status");
    form.tabIndex = -1;
    form.focus();
  } catch (error) {
    status.textContent = t[error.message] || t.genericError;
    window.turnstile?.reset();
    button.disabled = false;
  }
});
