let agreementChartLibrary;

function loadAgreementChartLibrary(src) {
  if (window.Chart) return Promise.resolve();
  if (!agreementChartLibrary) {
    agreementChartLibrary = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        agreementChartLibrary = undefined;
        reject(new Error("Chart could not load"));
      };
      document.head.append(script);
    });
  }
  return agreementChartLibrary;
}

async function openConnectionAgreement(url) {
  const dialog = document.getElementById("connection-agreement");
  if (!dialog || dialog.open) return;
  const content = dialog.querySelector("[data-agreement-content]");
  const subtitle = dialog.querySelector("[data-agreement-subtitle]");
  const status = document.createElement("p");
  status.className = "px-5 py-4 text-sm text-ink-secondary";
  status.setAttribute("role", "status");
  status.textContent = "Loading agreement…";
  content.replaceChildren(status);
  subtitle.hidden = true;
  dialog.showModal();

  const request = new AbortController();
  let chartId;
  dialog.addEventListener("close", () => {
    request.abort();
    if (chartId) window.__sdxCharts?.[chartId]?.destroy();
  }, { once: true });

  try {
    const response = await fetch(url, { signal: request.signal });
    if (!response.ok) throw new Error("Agreement unavailable");
    const markup = await response.text();
    if (request.signal.aborted || !dialog.open) return;
    const template = document.createElement("template");
    template.innerHTML = markup;
    const body = template.content.querySelector("[data-agreement-body]");
    if (!body) throw new Error("Missing agreement content");

    const subtitleText = template.content.querySelector("header p")
      ?.textContent;
    subtitle.textContent = subtitleText ?? "";
    subtitle.hidden = !subtitleText;
    const scripts = [...body.querySelectorAll("script")];
    scripts.forEach((script) => script.remove());
    content.replaceChildren(body);

    const traffic = body.querySelector("[data-agreement-traffic]");
    if (!traffic) return;
    chartId = traffic.dataset.metricsChart;
    for (const original of scripts) {
      const script = document.createElement("script");
      script.textContent = original.textContent;
      body.append(script);
    }
    const trafficStatus = traffic.querySelector("[data-traffic-status]");
    trafficStatus.textContent = "Loading traffic…";
    try {
      await loadAgreementChartLibrary(dialog.dataset.chartSrc);
      if (!request.signal.aborted && dialog.open) startAgreementTraffic(dialog);
    } catch {
      if (!request.signal.aborted) {
        trafficStatus.textContent = "Could not load the traffic chart.";
      }
    }
  } catch {
    if (!request.signal.aborted) {
      status.textContent = "Could not load this agreement.";
    }
  }
}

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
    const reportedDays = new Set(
      series?.flatMap(({ values }) =>
        values.filter(([, value]) => Number.isFinite(Number(value))).map((
          [day],
        ) => day)
      ),
    ).size;
    status.textContent = series == null
      ? "Connection traffic is currently unavailable."
      : reportedDays === 0
      ? "No traffic samples were returned for this period."
      : reportedDays < 30
      ? `Traffic is available for ${reportedDays} of 30 days. Blank days have no reported data.`
      : "";
    if (dialog.open) timer = setTimeout(refresh, 60_000);
  }

  status.textContent = "Loading traffic…";
  refresh();
}
