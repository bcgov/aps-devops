function selectSigningTab(dialog, name, focus = false) {
  dialog.querySelectorAll("[data-signing-tab]").forEach((tab) => {
    const active = tab.dataset.signingTab === name;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    tab.classList.toggle("border-transparent", !active);
    tab.classList.toggle("border-[#003366]", active);
    tab.classList.toggle("font-semibold", active);
    if (active && focus) tab.focus();
  });
  dialog.querySelectorAll("[data-signing-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.signingPanel !== name;
  });
  dialog.querySelector("[data-signing-status]").textContent = "";
}

document.addEventListener("click", async (event) => {
  const open = event.target.closest("[data-open-signing]");
  if (open) {
    open.parentElement.querySelector("[data-signing-dialog]").showModal();
    return;
  }
  const dialog = event.target.closest("[data-signing-dialog]");
  if (!dialog) return;
  if (event.target.closest("[data-close-signing]")) {
    dialog.close();
    return;
  }
  const tab = event.target.closest("[data-signing-tab]");
  if (tab) {
    selectSigningTab(dialog, tab.dataset.signingTab);
    return;
  }
  const button = event.target.closest("[data-copy-csr]");
  if (!button) return;
  const field = dialog.querySelector("[data-csr]");
  try {
    await navigator.clipboard.writeText(field.value);
    button.textContent = "CSR copied";
  } catch {
    field.focus();
    field.select();
    button.textContent = "Select and copy the CSR manually";
  }
});

document.addEventListener("keydown", (event) => {
  const tab = event.target.closest("[data-signing-tab]");
  if (!tab || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    return;
  }
  event.preventDefault();
  const name = event.key === "Home"
    ? "csr"
    : event.key === "End"
    ? "install"
    : tab.dataset.signingTab === "csr"
    ? "install"
    : "csr";
  selectSigningTab(tab.closest("dialog"), name, true);
});

function resetInstallReview(form) {
  form.querySelector('[name="operation"]').value = "review";
  form.querySelector('[name="confirmation"]').value = "";
  const checkbox = form.querySelector('[name="confirmed"]');
  checkbox.checked = false;
  checkbox.required = false;
  form.querySelector("[data-install-review]").hidden = true;
  form.querySelector("[data-review-install]").hidden = false;
}

document.addEventListener("input", (event) => {
  if (
    event.target.matches('[data-signing-form] textarea[name="certificate"]')
  ) {
    resetInstallReview(event.target.form);
    event.target.closest("dialog").querySelector("[data-signing-status]")
      .textContent = "";
  }
});

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-signing-form]");
  if (!form) return;
  event.preventDefault();
  const dialog = form.closest("dialog");
  const status = dialog.querySelector("[data-signing-status]");
  const buttons = dialog.querySelectorAll(
    'button[type="submit"], form button:not([type])',
  );
  if (dialog.dataset.busy) return;
  dialog.dataset.busy = "true";
  buttons.forEach((button) => button.disabled = true);
  status.textContent = "Working…";
  const data = new FormData(form);
  try {
    const response = await fetch(form.action, {
      method: "POST",
      redirect: "manual",
      body: data,
      headers: { accept: "application/json" },
    });
    if (
      response.redirected || response.type === "opaqueredirect" ||
      response.status === 401
    ) {
      throw new Error(
        "Your session has expired. Reload the page and sign in again.",
      );
    }
    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || "Request failed");
    }
    if (result.confirmation && result.review) {
      // If the certificate was edited while the review was loading, ask again.
      if (
        form.querySelector('[name="certificate"]').value !==
          data.get("certificate")
      ) {
        resetInstallReview(form);
        throw new Error(
          "Certificate changed. Select Install to review it again.",
        );
      }
      form.querySelector('[name="operation"]').value = "install";
      form.querySelector('[name="confirmation"]').value = result.confirmation;
      form.querySelector('[name="confirmed"]').required = true;
      form.querySelector("[data-install-review-message]").textContent =
        result.review;
      form.querySelector("[data-install-review]").hidden = false;
      form.querySelector("[data-review-install]").hidden = true;
      status.textContent =
        "Review the key set change and confirm before installing.";
      form.querySelector('[name="confirmed"]').focus();
    } else if (result.csr) {
      dialog.querySelector("[data-csr]").value = result.csr;
      dialog.querySelector("[data-csr-result]").hidden = false;
      dialog.querySelector("[data-copy-csr]").textContent =
        "Copy CSR to clipboard";
      status.textContent =
        "CSR created. Copy it and send it to the APS team for signing.";
    } else {
      status.textContent = result.message || "Registration succeeded.";
      dialog.dataset.installed = "true";
      form.reset();
      resetInstallReview(form);
    }
  } catch (error) {
    if (data.get("operation") === "install") resetInstallReview(form);
    console.error("Signing request failed", {
      operation: data.get("operation"),
      url: form.action,
      error: error.message,
    });
    status.textContent = error instanceof TypeError
      ? "Could not reach brochure-ui. The server may have restarted or the connection was interrupted. Keep this certificate, reload the page, and sign in again if prompted."
      : error.message;
  } finally {
    delete dialog.dataset.busy;
    buttons.forEach((button) => button.disabled = false);
  }
});

document.querySelectorAll("[data-signing-dialog]").forEach((dialog) => {
  dialog.addEventListener("close", () => {
    if (dialog.dataset.installed) {
      const url = new URL(location.href);
      url.pathname = "/runtimes";
      location.assign(url);
    }
  });
});
