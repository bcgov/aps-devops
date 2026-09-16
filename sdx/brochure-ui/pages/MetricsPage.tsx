import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/custom/Breadcrumb.tsx";
import { CONSOLE_PAGES } from "../components/custom/ConsoleNav.tsx";
import { TimeSeriesChart } from "../components/custom/TimeSeriesChart.tsx";
import type { MetricSeries } from "../components/custom/TimeSeriesChart.tsx";
import type { SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface ActivityData {
  status: string;
  data: { resultType: string; result: MetricSeries[] };
}

interface MetricsPageProps {
  konglogData: ActivityData;
  config: SiteConfig;
  currentPath: string;
  user?: SessionUser | null;
}

export function MetricsPage({
  konglogData,
  config: _config,
  currentPath,
  user,
}: MetricsPageProps) {
  const klResult = konglogData.data.result;

  const totalPoints = klResult.reduce(
    (n, s) => n + s.values.length,
    0,
  );

  const services = [
    ...new Set(klResult.map((s) => s.metric.service)),
  ].sort();

  return (
    <Layout title="Metrics" currentPath={currentPath} user={user}>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Member Console", href: "/console" },
          {
            label: "Metrics",
            menu: CONSOLE_PAGES.filter((p) => p.href !== "/metrics"),
          },
        ]}
      />

      {/* Page header */}
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-5xl font-bold mb-2">Metrics</h1>
          <p className="text-ink-invert-secondary">
            Request rate by service and response code, sampled from Prometheus.
          </p>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      {/* Summary stats */}
      <div className="bg-surface-muted border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-border px-4 py-3">
              <dt className="text-xs text-ink-secondary mb-1">Sources</dt>
              <dd className="font-semibold text-ink text-sm">1</dd>
            </div>
            <div className="bg-white rounded-lg border border-border px-4 py-3">
              <dt className="text-xs text-ink-secondary mb-1">Services</dt>
              <dd
                id="stat-services"
                className="font-semibold text-ink text-sm"
              >
                {services.length}
              </dd>
            </div>
            <div className="bg-white rounded-lg border border-border px-4 py-3">
              <dt className="text-xs text-ink-secondary mb-1">Total data points</dt>
              <dd
                id="stat-points"
                className="font-semibold text-ink text-sm"
              >
                {totalPoints}
              </dd>
            </div>
            <div className="bg-white rounded-lg border border-border px-4 py-3">
              <dt className="text-xs text-ink-secondary mb-1">Auto-refresh</dt>
              <dd>
                <div
                  role="group"
                  aria-label="Auto-refresh interval"
                  className="flex rounded-md border border-border overflow-hidden text-xs font-medium w-fit"
                >
                  {(
                    [
                      ["Off", "0"],
                      ["10s", "10"],
                      ["30s", "30"],
                    ] as [string, string][]
                  ).map(([label, secs], i) => (
                    <button
                      key={label}
                      type="button"
                      data-interval={secs}
                      aria-pressed={i === 0}
                      className={[
                        "refresh-opt px-3 py-1 transition-colors",
                        i === 0
                          ? "bg-bc-blue text-white"
                          : "bg-white text-ink-secondary hover:bg-surface-muted",
                        i > 0 ? "border-l border-border" : "",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span
                  id="refresh-countdown"
                  role="status"
                  aria-live="polite"
                  className="text-xs text-ink-placeholder tabular-nums mt-1 block"
                />
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Chart.js must load before the chart init script below */}
      <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <TimeSeriesChart
          id="chart-konglog"
          title="Request Rate"
          series={klResult}
          codeField="status"
        />
      </div>

      {/* Refresh script — refreshes the metrics chart in place */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
  var countdownTimer=null;
  var countdownEl=document.getElementById('refresh-countdown');

  function refreshMetrics(){
    var c=window.__sdxCharts&&window.__sdxCharts['chart-konglog'];
    if(!c)return;
    c.refresh('/api/activity/konglog').then(function(series){
      if(!series)return;
      var svcs=Array.from(new Set(series.map(function(s){return s.metric.service;}))).length;
      var pts=series.reduce(function(n,s){return n+s.values.length;},0);
      var sEl=document.getElementById('stat-services');
      var pEl=document.getElementById('stat-points');
      if(sEl)sEl.textContent=svcs;
      if(pEl)pEl.textContent=pts;
    });
  }

  function stopAll(){
    if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}
    countdownEl.textContent='';
  }
  function startRefresh(secs){
    var remaining=secs;
    countdownEl.textContent='Refreshing in '+remaining+'s';
    countdownTimer=setInterval(function(){
      remaining--;
      if(remaining<0){
        countdownEl.textContent='Refreshing…';
        refreshMetrics();
        remaining=secs;
      } else {
        countdownEl.textContent='Refreshing in '+remaining+'s';
      }
    },1000);
  }
  function activate(secs){
    stopAll();
    document.querySelectorAll('.refresh-opt').forEach(function(b){
      var match=parseInt(b.dataset.interval,10)===secs;
      b.setAttribute('aria-pressed', match ? 'true' : 'false');
      b.classList.toggle('bg-bc-blue', match);
      b.classList.toggle('text-white', match);
      b.classList.toggle('bg-white', !match);
      b.classList.toggle('text-ink-secondary', !match);
    });
    if(secs>0)startRefresh(secs);
  }
  document.querySelectorAll('.refresh-opt').forEach(function(btn){
    btn.addEventListener('click',function(){
      var secs=parseInt(btn.dataset.interval,10);
      sessionStorage.setItem('sdx-refresh',String(secs));
      activate(secs);
    });
  });
  var saved=parseInt(sessionStorage.getItem('sdx-refresh')||'0',10);
  if(saved>0)activate(saved);
})();`,
        }}
      />
    </Layout>
  );
}
