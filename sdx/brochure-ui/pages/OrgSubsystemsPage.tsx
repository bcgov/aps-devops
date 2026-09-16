import { Layout } from "../components/Layout.tsx";
import { Breadcrumb, type Crumb } from "../components/Breadcrumb.tsx";
import { OrgPicker } from "../components/OrgPicker.tsx";
import { CONSOLE_PAGES } from "../components/ConsoleNav.tsx";
import type { Organization, Subsystem, SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface OrgSubsystemsPageProps {
  organizations: Organization[];
  selectedOrg: Organization | null;
  subsystems: Subsystem[];
  error: string | null;
  config: SiteConfig;
  currentPath: string;
  user: SessionUser;
}

const DIALOG_STYLE = `
dialog.sdx-subsystem-dialog { border: none; border-radius: var(--layout-border-radius-large); padding: 0; max-width: 760px; width: 92%; box-shadow: var(--surface-shadow-large); }
dialog.sdx-subsystem-dialog::backdrop { background: var(--surface-color-overlay-default); }
`;

// Detail is fetched on demand (and cached) when a panel is opened, rather than
// pre-fetched for every subsystem up front. js-yaml re-emits the JSON detail
// response as YAML; highlight.js styles it — same vendored pair used by the
// Activity feed's detail dialog.
const PANEL_SCRIPT = `
(function(){
  var dlg = document.getElementById('subsystem-detail');
  var dlgTitle = document.getElementById('subsystem-detail-title');
  var dlgSubtitle = document.getElementById('subsystem-detail-subtitle');
  var dlgBody = document.getElementById('subsystem-detail-body');
  var dlgError = document.getElementById('subsystem-detail-error');
  if(!dlg) return;
  var cache = {};

  function toYaml(obj){
    try {
      if(window.jsyaml && window.jsyaml.dump){
        return window.jsyaml.dump(obj, {noRefs:true, lineWidth:100, sortKeys:false});
      }
    } catch(_) {}
    return JSON.stringify(obj, null, 2);
  }
  function render(text){
    dlgBody.removeAttribute('data-highlighted');
    dlgBody.className = 'language-yaml whitespace-pre-wrap break-all';
    dlgBody.textContent = text;
    try { if(window.hljs) window.hljs.highlightElement(dlgBody); } catch(_) {}
  }
  function openDialog(clientId, name){
    dlgTitle.textContent = name || clientId;
    dlgSubtitle.textContent = clientId;
    dlgError.style.display = 'none';
    if(typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open','');
    if(cache[clientId] !== undefined){ render(cache[clientId]); return; }
    render('Loading…');
    fetch('/api/subsystems/' + encodeURIComponent(clientId), {headers:{accept:'application/json'}})
      .then(function(res){
        if(!res.ok) return res.text().then(function(body){ throw new Error('HTTP ' + res.status + (body ? ': ' + body : '')); });
        return res.json();
      })
      .then(function(data){
        var yaml = toYaml(data);
        cache[clientId] = yaml;
        render(yaml);
      })
      .catch(function(e){
        render('');
        dlgError.textContent = 'Could not load subsystem detail: ' + e.message;
        dlgError.style.display = '';
      });
  }
  document.addEventListener('click', function(e){
    var btn = e.target.closest && e.target.closest('[data-view-subsystem]');
    if(btn){
      e.preventDefault();
      openDialog(btn.getAttribute('data-client-id'), btn.getAttribute('data-subsystem-name'));
      return;
    }
    var close = e.target.closest && e.target.closest('[data-close-subsystem]');
    if(close){
      e.preventDefault();
      if(typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
    }
  });
})();
`;

function SubsystemRow({ subsystem }: { subsystem: Subsystem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-bc-blue truncate">
          {subsystem.name}
        </p>
        <p className="text-xs text-ink-secondary font-mono truncate">
          {subsystem.clientId}
        </p>
      </div>
      <button
        type="button"
        data-view-subsystem
        data-client-id={subsystem.clientId}
        data-subsystem-name={subsystem.name}
        className="shrink-0 inline-flex items-center justify-center gap-2 rounded font-medium transition-colors bg-transparent border border-bc-blue text-bc-blue hover:bg-btn-tertiary-hover text-xs px-3 py-1.5"
      >
        View detail
      </button>
    </li>
  );
}

export function OrgSubsystemsPage({
  organizations,
  selectedOrg,
  subsystems,
  error,
  config: _config,
  currentPath,
  user,
}: OrgSubsystemsPageProps) {
  const breadcrumbItems: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Member Console", href: "/console" },
    {
      label: "Subsystems",
      menu: CONSOLE_PAGES.filter((p) => p.href !== "/org-subsystems"),
    },
  ];
  if (selectedOrg) breadcrumbItems.push({ label: selectedOrg.title });

  const sorted = subsystems
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Layout
      title="Subsystems"
      currentPath={currentPath}
      user={user}
    >
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold mb-2">
            Subsystems
          </h1>
          <p className="text-ink-invert-secondary max-w-2xl">
            Subsystems registered to an organization member.
            Open a subsystem to view its full client detail.
          </p>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      {/* Picker */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <OrgPicker
            organizations={organizations}
            selectedOrg={selectedOrg}
            action="/org-subsystems"
            submitLabel="Load subsystems"
            autoSubmit
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 rounded-md border-l-4 border-support-danger-border bg-support-danger-bg text-ink px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {!selectedOrg ? (
          <div className="text-center py-16 bg-surface-muted rounded-lg border border-border">
            <p className="text-ink-secondary">
              Select an organization member above to view its
              subsystems.
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 bg-surface-muted rounded-lg border border-border">
            <p className="text-ink-secondary">
              This organization has no registered
              subsystems.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-lg overflow-hidden">
            <ul className="divide-y divide-border">
              {sorted.map((s) => (
                <SubsystemRow key={s.clientId} subsystem={s} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Vendored, self-hosted libraries (no third-party runtime dependency):
          js-yaml renders the detail response as YAML, highlight.js styles it. */}
      <link
        rel="stylesheet"
        href="/public/vendor/highlight-github.min.css"
      />
      <script src="/public/vendor/js-yaml.min.js" />
      <script src="/public/vendor/highlight.min.js" />

      <style dangerouslySetInnerHTML={{ __html: DIALOG_STYLE }} />

      {/* Detail panel */}
      <dialog
        id="subsystem-detail"
        className="sdx-subsystem-dialog"
        aria-labelledby="subsystem-detail-title"
      >
        <div className="px-5 py-4 border-b border-border">
          <h2
            id="subsystem-detail-title"
            className="text-lg font-bold text-bc-blue"
          />
          <p
            id="subsystem-detail-subtitle"
            className="text-xs text-ink-secondary font-mono mt-0.5"
          />
        </div>
        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-auto">
          <div
            id="subsystem-detail-error"
            style={{ display: "none" }}
            className="rounded-md border-l-4 border-support-danger-border bg-support-danger-bg text-ink px-3 py-2 text-sm"
          />
          <pre className="text-xs bg-surface-muted border border-border rounded p-3 overflow-auto">
            <code
              id="subsystem-detail-body"
              className="language-yaml whitespace-pre-wrap break-all"
            />
          </pre>
        </div>
        <div className="px-5 py-3 bg-surface-muted border-t border-border flex justify-end">
          <button
            type="button"
            data-close-subsystem
            className="inline-flex items-center justify-center gap-2 rounded font-medium transition-colors bg-btn-secondary border border-border-dark text-ink hover:bg-btn-secondary-hover text-sm px-3 py-2"
          >
            Close
          </button>
        </div>
      </dialog>

      <script dangerouslySetInnerHTML={{ __html: PANEL_SCRIPT }} />
    </Layout>
  );
}
