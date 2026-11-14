(() => {
  document.addEventListener("click", (event) => {
    const host = event.target.closest("[data-request-verifier]");
    if (!host) return;
    const dialog = host.querySelector("dialog");
    if (event.target.closest("[data-open-request-verifier]")) {
      dialog.showModal();
    }
    if (event.target.closest("[data-close-request-verifier]")) dialog.close();
  });
  document.addEventListener("input", (event) => {
    const form = event.target.closest("[data-request-verifier-form]");
    if (!form) return;
    const dialog = form.closest("dialog");
    dialog.querySelector("[data-request-verifier-result]").textContent = "";
    dialog.querySelector("[data-request-verifier-checks]").replaceChildren();
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-request-verifier-form]");
    if (!form) return;
    event.preventDefault();
    const dialog = form.closest("dialog");
    if (dialog.dataset.busy) return;
    dialog.dataset.busy = "true";
    const result = dialog.querySelector("[data-request-verifier-result]");
    const checks = dialog.querySelector("[data-request-verifier-checks]");
    const button = form.querySelector("button");
    const fields = form.querySelectorAll("input, textarea");
    const data = new FormData(form);
    button.disabled = true;
    fields.forEach((field) => field.readOnly = true);
    result.textContent = "Checking…";
    result.className = "font-semibold text-gray-700";
    checks.replaceChildren();
    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: data,
        headers: { accept: "application/json" },
        redirect: "error",
      });
      if (!response.ok) {
        throw new Error(`Verification request failed (${response.status})`);
      }
      const output = await response.json();
      result.textContent = output.verified
        ? "✓ Verified"
        : "✕ Failed verification";
      result.className = `font-semibold ${
        output.verified ? "text-green-800" : "text-red-800"
      }`;
      for (const check of output.checks) {
        const row = document.createElement("li");
        row.textContent = `${
          check.passed ? "✓" : "✕"
        } ${check.label}: ${check.message}`;
        checks.append(row);
      }
    } catch (error) {
      result.textContent = "✕ Failed verification";
      result.className = "font-semibold text-red-800";
      const row = document.createElement("li");
      row.textContent = error instanceof TypeError
        ? "Could not reach brochure-ui. Check the connection and reload the page."
        : error.message;
      checks.append(row);
    } finally {
      delete dialog.dataset.busy;
      button.disabled = false;
      fields.forEach((field) => field.readOnly = false);
    }
  });
})();
