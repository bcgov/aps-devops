function startAgreementTraffic(dialog) {
  const section = dialog.querySelector("[data-agreement-traffic]");
  if (!section) return;

  const status = section.querySelector("[data-traffic-status]");
  const request = new AbortController();
  let timer;

  dialog.addEventListener("close", () => {
    request.abort();
    clearTimeout(timer);
  }, { once: true });

  async function refresh() {
    const chart = window.__sdxCharts?.[section.dataset.metricsChart];
    const series = await chart?.refresh(section.dataset.agreementTraffic, {
      signal: request.signal,
      cache: "no-store",
    });
    if (request.signal.aborted) return;
    status.textContent = series == null
      ? "Connection traffic is currently unavailable."
      : series.length === 0
      ? "No traffic data was recorded for this connection."
      : "";
    if (dialog.open) timer = setTimeout(refresh, 60_000);
  }

  status.textContent = "Loading traffic…";
  refresh();
}
