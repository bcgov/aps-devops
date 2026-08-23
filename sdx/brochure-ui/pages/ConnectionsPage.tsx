import { Layout } from "../components/Layout.tsx";
import {
  Breadcrumb,
  type Crumb,
} from "../components/Breadcrumb.tsx";
import { OrgPicker } from "../components/OrgPicker.tsx";
import { CONSOLE_PAGES } from "../components/ConsoleNav.tsx";
import type {
  ConnectionGatewayPattern,
  ConnectionProvisionerStatus,
  ConnectionRequest,
  Organization,
  Scope,
  Service,
  SiteConfig,
  Subsystem,
} from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";
import {
  ENVIRONMENTS,
  normalizeEnv,
} from "../lib/environments.ts";

interface ConnectionsPageProps {
  organizations: Organization[];
  selectedOrg: Organization | null;
  connections: ConnectionRequest[];
  orgSubsystems: Subsystem[];
  allSubsystems: Subsystem[];
  services: Service[];
  config: SiteConfig;
  currentPath: string;
  user: SessionUser;
  flash?: {
    kind: "success" | "error";
    message: string;
  } | null;
  error?: string | null;
}

function StatusPill({
  connection,
}: {
  connection: ConnectionRequest;
}) {
  if (connection.isApproved && connection.isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
        <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
        Active
      </span>
    );
  }
  if (connection.isApproved) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-600" />
      Pending
    </span>
  );
}

function ProvisionerStatusPill({
  status,
}: {
  status: ConnectionProvisionerStatus;
}) {
  if (status.status === "provisioned") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
        <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
        Provisioned
      </span>
    );
  }
  if (status.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
        Provisioning failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
      {status.status}
    </span>
  );
}

const WIZARD_SCRIPT = `
(function(){
  var dlg = document.getElementById('add-dialog');
  if (!dlg) return;
  var form = document.getElementById('wiz-form');
  if (!form) return;
  var clientInput = document.getElementById('wiz-client-id');
  var policyInput = document.getElementById('wiz-policy');
  var selectionsInput = document.getElementById('wiz-selections');
  var reviewEl = document.getElementById('wiz-review');
  var reviewClientEl = document.getElementById('wiz-review-client');
  var backBtn = document.getElementById('wiz-back');
  var nextBtn = document.getElementById('wiz-next');
  var submitBtn = document.getElementById('wiz-submit');
  var current = 1;

  function setStep(n) {
    current = n;
    var steps = form.querySelectorAll('[data-step]');
    for (var i = 0; i < steps.length; i++) {
      if (steps[i].getAttribute('data-step') === String(n)) steps[i].classList.remove('hidden');
      else steps[i].classList.add('hidden');
    }
    var pills = form.querySelectorAll('[data-step-pill]');
    for (var j = 0; j < pills.length; j++) {
      var pn = parseInt(pills[j].getAttribute('data-step-pill'), 10);
      var num = pills[j].querySelector('.wiz-pill-num');
      if (pn < n) {
        if (num) { num.style.backgroundColor = '#003366'; num.style.color = 'white'; }
        pills[j].style.color = '#003366';
      } else if (pn === n) {
        if (num) { num.style.backgroundColor = '#FCBA19'; num.style.color = '#003366'; }
        pills[j].style.color = '#003366';
      } else {
        if (num) { num.style.backgroundColor = '#e5e7eb'; num.style.color = '#4b5563'; }
        pills[j].style.color = '#6b7280';
      }
    }
    var step1Hidden = (form.querySelector('[data-step="1"]') || {}).classList && form.querySelector('[data-step="1"]').classList.contains('hidden');
    var minStep = step1Hidden ? 2 : 1;
    backBtn.style.visibility = n === minStep ? 'hidden' : 'visible';
    if (n === 4) {
      nextBtn.classList.add('hidden');
      submitBtn.classList.remove('hidden');
      renderReview();
    } else {
      nextBtn.classList.remove('hidden');
      submitBtn.classList.add('hidden');
    }
  }

  function applyPolicyMode(policy) {
    var tree = form.querySelector('.wiz-tree');
    if (!tree) return;
    tree.classList.toggle('policy-hide-scopes', policy !== 'SDX.R2.00');
  }

  function ownCheckbox(li) {
    return li.querySelector(':scope > .wz-label > .wz-cb');
  }
  function directChildLis(li) {
    var ul = li.querySelector(':scope > ul');
    if (!ul) return [];
    var out = [];
    for (var i = 0; i < ul.children.length; i++) {
      var c = ul.children[i];
      if (c.classList && c.classList.contains('wz-node')) out.push(c);
    }
    return out;
  }
  function parentLi(li) {
    var p = li.parentElement;
    while (p && !(p.classList && p.classList.contains('wz-node'))) p = p.parentElement;
    return p;
  }
  function descendantCheckboxes(li) {
    return li.querySelectorAll(':scope > ul .wz-cb');
  }
  function updateSelf(li) {
    var cb = ownCheckbox(li);
    var children = directChildLis(li);
    if (!cb || children.length === 0) return;
    var checked = 0, indet = 0;
    for (var i = 0; i < children.length; i++) {
      var ch = ownCheckbox(children[i]);
      if (!ch) continue;
      if (ch.indeterminate) indet++;
      else if (ch.checked) checked++;
    }
    if (indet > 0) { cb.indeterminate = true; cb.checked = false; }
    else if (checked === children.length) { cb.indeterminate = false; cb.checked = true; }
    else if (checked === 0) { cb.indeterminate = false; cb.checked = false; }
    else { cb.indeterminate = true; cb.checked = false; }
  }

  document.addEventListener('change', function(ev) {
    var t = ev.target;
    if (!(t && t.classList && t.classList.contains('wz-cb'))) return;
    var li = t.closest('.wz-node');
    if (!li) return;
    var desc = descendantCheckboxes(li);
    for (var i = 0; i < desc.length; i++) {
      desc[i].checked = t.checked;
      desc[i].indeterminate = false;
    }
    var p = parentLi(li);
    while (p) { updateSelf(p); p = parentLi(p); }
  });

  function buildSelections() {
    var out = [];
    var serviceNodes = form.querySelectorAll('.wz-node[data-node-type="service"]');
    for (var i = 0; i < serviceNodes.length; i++) {
      var n = serviceNodes[i];
      var cb = ownCheckbox(n);
      if (!cb) continue;
      if (!cb.checked && !cb.indeterminate) continue;
      var scopes = [];
      var scopeCbs = n.querySelectorAll('.wz-cb[data-node-type="scope"]');
      for (var j = 0; j < scopeCbs.length; j++) {
        if (scopeCbs[j].checked) scopes.push(scopeCbs[j].getAttribute('data-scope'));
      }
      out.push({
        serviceId: n.getAttribute('data-service'),
        subsystem: n.getAttribute('data-subsystem'),
        scopes: scopes
      });
    }
    return out;
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function renderReview() {
    var sel;
    try { sel = JSON.parse(selectionsInput.value || '[]'); } catch(_) { sel = []; }
    reviewClientEl.textContent = clientInput.value || '(client)';
    if (!sel.length) {
      reviewEl.innerHTML = '<p class="text-sm text-gray-500 italic">No services selected.</p>';
      return;
    }
    var html = '<ul class="space-y-2">';
    for (var i = 0; i < sel.length; i++) {
      var s = sel[i];
      html += '<li class="border border-gray-200 rounded p-3">';
      html += '<div class="font-mono text-xs text-[#003366]">' + escHtml(s.serviceId) + '</div>';
      if (s.scopes && s.scopes.length) {
        html += '<div class="mt-1 flex flex-wrap gap-1">';
        for (var j = 0; j < s.scopes.length; j++) {
          html += '<span class="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-mono">' + escHtml(s.scopes[j]) + '</span>';
        }
        html += '</div>';
      } else {
        html += '<div class="mt-1 text-xs text-gray-500 italic">No scopes &mdash; request access to all operations</div>';
      }
      html += '</li>';
    }
    html += '</ul>';
    reviewEl.innerHTML = html;
  }

  backBtn.addEventListener('click', function() {
    var step1Hidden = form.querySelector('[data-step="1"]').classList.contains('hidden');
    var minStep = step1Hidden ? 2 : 1;
    if (current > minStep) setStep(current - 1);
  });
  nextBtn.addEventListener('click', function() {
    if (current === 1) {
      var picked = form.querySelector('input[name="wiz-client-radio"]:checked');
      if (!picked) { alert('Choose a client subsystem first.'); return; }
      clientInput.value = picked.value;
      setStep(2);
    } else if (current === 2) {
      var pickedPolicy = form.querySelector('input[name="wiz-policy-radio"]:checked');
      if (!pickedPolicy) { alert('Choose an auth policy first.'); return; }
      policyInput.value = pickedPolicy.value;
      applyPolicyMode(pickedPolicy.value);
      setStep(3);
    } else if (current === 3) {
      var sel = buildSelections();
      if (sel.length === 0) { alert('Select at least one API to request.'); return; }
      selectionsInput.value = JSON.stringify(sel);
      setStep(4);
    }
  });

  function applyEnvFilter(env) {
    var opts = form.querySelectorAll('[data-wiz-env-opt]');
    for (var i = 0; i < opts.length; i++) {
      var b = opts[i], on = b.getAttribute('data-wiz-env-opt') === env;
      b.classList.toggle('bg-white', on);
      b.classList.toggle('text-gray-900', on);
      b.classList.toggle('shadow-sm', on);
      b.classList.toggle('text-gray-500', !on);
      b.classList.toggle('hover:text-gray-700', !on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    var svcNodes = form.querySelectorAll('.wz-node[data-node-type="service"]');
    for (var j = 0; j < svcNodes.length; j++) {
      var se = svcNodes[j].getAttribute('data-env') || '';
      var show = !env || se === '' || se === env;
      svcNodes[j].style.display = show ? '' : 'none';
    }
    // Hide subsystem / org rows that have no service visible under the filter.
    var subNodes = form.querySelectorAll('.wz-node[data-node-type="subsystem"]');
    for (var k = 0; k < subNodes.length; k++) {
      var svcs = subNodes[k].querySelectorAll('.wz-node[data-node-type="service"]');
      var anySvc = false;
      for (var m = 0; m < svcs.length; m++) { if (svcs[m].style.display !== 'none') { anySvc = true; break; } }
      subNodes[k].style.display = anySvc ? '' : 'none';
    }
    var orgNodes = form.querySelectorAll('.wz-node[data-node-type="org"]');
    for (var p = 0; p < orgNodes.length; p++) {
      var subs = orgNodes[p].querySelectorAll('.wz-node[data-node-type="subsystem"]');
      var anySub = false;
      for (var q = 0; q < subs.length; q++) { if (subs[q].style.display !== 'none') { anySub = true; break; } }
      orgNodes[p].style.display = anySub ? '' : 'none';
    }
  }

  form.addEventListener('click', function(ev) {
    var opt = ev.target.closest('[data-wiz-env-opt]');
    if (!opt) return;
    ev.preventDefault();
    applyEnvFilter(opt.getAttribute('data-wiz-env-opt') || '');
  });

  document.addEventListener('click', function(e) {
    var openBtn = e.target.closest('[data-open-dialog]');
    if (openBtn) {
      e.preventDefault();
      var target = document.getElementById(openBtn.dataset.openDialog);
      if (!target) return;
      var defaultClient = target.getAttribute('data-default-client-id') || '';
      var step1 = form.querySelector('[data-step="1"]');
      var pill1 = form.querySelector('[data-step-pill="1"]');
      if (defaultClient) {
        if (step1) step1.classList.add('hidden');
        if (pill1) pill1.classList.add('hidden');
      } else {
        if (step1) step1.classList.remove('hidden');
        if (pill1) pill1.classList.remove('hidden');
      }
      var radios = form.querySelectorAll('input[name="wiz-client-radio"]');
      for (var i = 0; i < radios.length; i++) radios[i].checked = false;
      var policyRadios = form.querySelectorAll('input[name="wiz-policy-radio"]');
      for (var k = 0; k < policyRadios.length; k++) policyRadios[k].checked = false;
      var cbs = form.querySelectorAll('.wz-cb');
      for (var j = 0; j < cbs.length; j++) { cbs[j].checked = false; cbs[j].indeterminate = false; }
      clientInput.value = defaultClient;
      policyInput.value = '';
      selectionsInput.value = '[]';
      applyEnvFilter('');
      applyPolicyMode('');
      setStep(defaultClient ? 2 : 1);
      if (typeof target.showModal === 'function') target.showModal();
      else target.setAttribute('open', '');
      return;
    }
    var closeBtn = e.target.closest('[data-close-dialog]');
    if (closeBtn) {
      e.preventDefault();
      var d = closeBtn.closest('dialog');
      if (d) {
        if (typeof d.close === 'function') d.close();
        else d.removeAttribute('open');
      }
    }
  });

  applyEnvFilter('');
  setStep(1);
})();
`;

const DIALOG_STYLE = `
dialog.sdx-dialog { border: none; border-radius: 8px; padding: 0; max-width: 560px; width: 92%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
dialog.sdx-dialog.sdx-dialog-wide { max-width: 760px; }
dialog.sdx-dialog::backdrop { background: rgba(0,0,0,0.45); }
.wiz-tree ul { list-style: none; padding: 0; margin: 0; }
.wiz-tree > ul > li { margin-bottom: 0.5rem; }
.wiz-tree li > ul { margin-left: 1.25rem; border-left: 1px dashed #e5e7eb; padding-left: 0.5rem; }
.wiz-tree .wz-label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 2px 4px; border-radius: 3px; }
.wiz-tree .wz-label:hover { background-color: #f9fafb; }
.wiz-tree.policy-hide-scopes .wz-node[data-node-type="scope"] { display: none; }
`;

const DIALOG_SCRIPT = `
(function(){
  document.addEventListener('click', function(e){
    var o = e.target.closest && e.target.closest('[data-dialog-open]');
    if (o) {
      e.preventDefault();
      var d = document.getElementById(o.getAttribute('data-dialog-open'));
      if (d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open',''); }
      return;
    }
    var c = e.target.closest && e.target.closest('[data-dialog-close]');
    if (c) {
      e.preventDefault();
      var dd = c.closest('dialog');
      if (dd) { if (typeof dd.close === 'function') dd.close(); else dd.removeAttribute('open'); }
    }
  });
})();
`;

// Drives the Edit connection dialog(s): show/hide the property panels as
// include toggles flip, and — on save — walk the form to assemble the
// clientResources/serviceResources/isActive payload into a hidden input so the
// existing form-POST + flash pattern can carry it to the server.
const EDIT_SCRIPT = `
(function(){
  function collectFields(scope, obj){
    var els = scope.querySelectorAll('[data-field]');
    for (var i=0;i<els.length;i++){
      var el = els[i];
      var key = el.getAttribute('data-field');
      var type = el.getAttribute('data-field-type');
      if (type === 'bool') { obj[key] = !!el.checked; }
      else if (type === 'set') {
        var arr = (el.value||'').split(/[\\n,]+/).map(function(s){return s.trim();}).filter(Boolean);
        obj[key] = arr;
      } else {
        var v = (el.value||'').trim();
        if (v !== '') obj[key] = v;
      }
    }
  }
  function buildPatterns(form, res){
    var patterns = {};
    var pcs = form.querySelectorAll('[data-pattern][data-res="'+res+'"]');
    for (var i=0;i<pcs.length;i++){
      var pc = pcs[i];
      var inc = pc.querySelector('[data-pattern-include]');
      if (!inc || !inc.checked) continue;
      var obj = {};
      var pf = pc.querySelector('[data-pattern-fields]');
      if (pf) collectFields(pf, obj);
      var upgrades = {};
      var ucs = pc.querySelectorAll('[data-upgrade]');
      for (var j=0;j<ucs.length;j++){
        var uc = ucs[j];
        var uinc = uc.querySelector('[data-upgrade-include]');
        if (!uinc || !uinc.checked) continue;
        var uobj = {};
        collectFields(uc, uobj);
        upgrades[uc.getAttribute('data-upgrade-key')] = uobj;
      }
      if (Object.keys(upgrades).length) obj.upgrades = upgrades;
      patterns[pc.getAttribute('data-pattern-key')] = obj;
    }
    return patterns;
  }

  document.addEventListener('change', function(ev){
    var t = ev.target;
    if (!t || !t.hasAttribute) return;
    if (t.hasAttribute('data-pattern-include')) {
      var pc = t.closest('[data-pattern]');
      var body = pc && pc.querySelector('[data-pattern-body]');
      if (body) body.classList.toggle('hidden', !t.checked);
    } else if (t.hasAttribute('data-upgrade-include')) {
      var uc = t.closest('[data-upgrade]');
      var ub = uc && uc.querySelector('[data-upgrade-body]');
      if (ub) ub.classList.toggle('hidden', !t.checked);
    }
  });

  document.addEventListener('submit', function(ev){
    var f = ev.target;
    if (!(f && f.classList && f.classList.contains('conn-edit-form'))) return;
    var activeEl = f.querySelector('[data-active-toggle]');
    var subEl = f.querySelector('[data-subsystem-id]');
    var sub = subEl ? (subEl.value||'').trim() : '';
    var servicePatterns = buildPatterns(f, 'service');
    var serviceResources;
    if (sub || Object.keys(servicePatterns).length) {
      serviceResources = { gatewayPatterns: servicePatterns };
      if (sub) serviceResources.subsystemId = sub;
    }
    var payload = {
      isActive: activeEl ? !!activeEl.checked : undefined,
      clientResources: { gatewayPatterns: buildPatterns(f, 'client') },
      serviceResources: serviceResources
    };
    var hidden = f.querySelector('[data-edit-payload]');
    if (hidden) hidden.value = JSON.stringify(payload);
  });
})();
`;

function fmtBool(v?: boolean): string | undefined {
  return v === undefined ? undefined : v ? "true" : "false";
}

function MetaBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-mono">
      {label}
    </span>
  );
}

function FieldRow({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  if (value === undefined || value === null || value === "")
    return null;
  return (
    <>
      <dt className="text-gray-500">{label}</dt>
      <dd
        className={
          mono
            ? "font-mono text-gray-800 break-all"
            : "text-gray-800 break-all"
        }
      >
        {value}
      </dd>
    </>
  );
}

function ScopeChips({ scopes }: { scopes?: string[] }) {
  if (!scopes || scopes.length === 0) {
    return (
      <span className="text-gray-400 italic">none</span>
    );
  }
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {scopes.map((s) => (
        <span
          key={s}
          className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded font-mono"
        >
          {s}
        </span>
      ))}
    </span>
  );
}

function UpgradesView({
  upgrades,
}: {
  upgrades: NonNullable<
    ConnectionGatewayPattern["upgrades"]
  >;
}) {
  const flags: string[] = [];
  if (upgrades.sign) flags.push("sign");
  if (upgrades.verify) flags.push("verify");
  if (upgrades.counter_sign) flags.push("counter_sign");
  const token = upgrades.token;
  const tx = upgrades.token_exchange;
  return (
    <div className="mt-2 space-y-2">
      {flags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {flags.map((f) => (
            <span
              key={f}
              className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-mono"
            >
              {f}
            </span>
          ))}
        </div>
      )}
      {token && (
        <div className="border border-gray-100 rounded p-2 bg-gray-50/60">
          <div className="text-xs font-semibold text-gray-600 mb-1">
            token
          </div>
          <dl className="grid grid-cols-[200px,1fr] gap-x-3 gap-y-0.5">
            <FieldRow
              label="allowed_aud"
              value={token.allowed_aud}
              mono
            />
            <FieldRow
              label="allowed_iss"
              value={token.allowed_iss}
              mono
            />
            <FieldRow
              label="scope"
              value={token.scope}
              mono
            />
            <FieldRow
              label="consumer_match"
              value={fmtBool(token.consumer_match)}
              mono
            />
            <FieldRow
              label="consumer_match_claim"
              value={token.consumer_match_claim}
              mono
            />
            <FieldRow
              label="consumer_match_claim_custom_id"
              value={fmtBool(
                token.consumer_match_claim_custom_id,
              )}
              mono
            />
            <FieldRow
              label="consumer_match_ignore_not_found"
              value={fmtBool(
                token.consumer_match_ignore_not_found,
              )}
              mono
            />
          </dl>
        </div>
      )}
      {tx && (
        <div className="border border-gray-100 rounded p-2 bg-gray-50/60">
          <div className="text-xs font-semibold text-gray-600 mb-1">
            token_exchange
          </div>
          <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-0.5">
            <FieldRow
              label="client_id"
              value={tx.client_id}
              mono
            />
            <FieldRow
              label="token_endpoint"
              value={tx.token_endpoint}
              mono
            />
            <FieldRow
              label="audience"
              value={tx.audience}
              mono
            />
          </dl>
          <div className="mt-1">
            <span className="text-gray-500">scopes </span>
            <ScopeChips scopes={tx.scopes} />
          </div>
        </div>
      )}
    </div>
  );
}

function GatewayPatterns({
  patterns,
}: {
  patterns?: Record<string, ConnectionGatewayPattern>;
}) {
  const entries = patterns ? Object.entries(patterns) : [];
  if (entries.length === 0) {
    return (
      <p className="text-gray-400 italic">
        No gateway patterns.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {entries.map(([name, p]) => (
        <div
          key={name}
          className="border border-gray-200 rounded bg-white"
        >
          <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100 font-mono text-xs text-[#003366]">
            {name}
          </div>
          <div className="px-3 py-2">
            <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1">
              <FieldRow
                label="strip_path"
                value={fmtBool(p.strip_path)}
                mono
              />
              <FieldRow
                label="client_id"
                value={p.client_id}
                mono
              />
              <FieldRow
                label="service_id"
                value={p.service_id}
                mono
              />
            </dl>
            {p.upgrades && (
              <UpgradesView upgrades={p.upgrades} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        {title}
      </h4>
      {children}
    </section>
  );
}

/** policyVersion identifies the submission channel ("Submitted by"). */
function submittedByLabel(policyVersion?: string): {
  label: string;
  cls: string;
} | null {
  if (!policyVersion) return null;
  if (policyVersion === "SDX.R0.00")
    return {
      label: "SDX",
      cls: "bg-blue-100 text-blue-800 border-blue-200",
    };
  if (policyVersion === "SDX.R1.00")
    return {
      label: "Common SSO",
      cls: "bg-purple-100 text-purple-800 border-purple-200",
    };
  return {
    label: policyVersion,
    cls: "bg-gray-100 text-gray-700 border-gray-200",
  };
}

function SubmittedByBadge({
  policyVersion,
}: {
  policyVersion?: string;
}) {
  const info = submittedByLabel(policyVersion);
  if (!info) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full border ${info.cls}`}
    >
      <span className="text-xs font-medium uppercase tracking-wide opacity-70">
        Submitted by
      </span>
      {info.label}
    </span>
  );
}

// ── Edit connection dialog ────────────────────────────────────────────────
// Declarative spec of the full set of gateway patterns / upgrades / fields the
// upsert endpoint accepts. Rendered as include/exclude toggles; a pattern or
// upgrade's field values are only sent when it is included. Field keys are the
// camelCase write-model names the backend expects.

type EditFieldType = "string" | "bool" | "set";

interface EditFieldSpec {
  key: string;
  label: string;
  type: EditFieldType;
  placeholder?: string;
  hint?: string;
}

interface UpgradeSpec {
  key: string;
  label: string;
  description: string;
  fields: EditFieldSpec[];
}

interface PatternSpec {
  key: string;
  label: string;
  description: string;
  fields: EditFieldSpec[];
  upgrades: UpgradeSpec[];
}

const TOKEN_FIELDS: EditFieldSpec[] = [
  {
    key: "allowedIss",
    label: "Allowed issuers",
    type: "set",
    placeholder: "one issuer per line",
    hint: "One or more accepted token issuers (iss).",
  },
  {
    key: "allowedAud",
    label: "Allowed audience",
    type: "string",
    hint: "Accepted token audience (aud).",
  },
  { key: "scope", label: "Scope", type: "string" },
  {
    key: "consumerMatch",
    label: "Consumer match",
    type: "bool",
  },
  {
    key: "consumerMatchClaim",
    label: "Consumer match claim",
    type: "string",
  },
  {
    key: "consumerMatchClaimCustomId",
    label: "Consumer match claim uses custom id",
    type: "bool",
  },
  {
    key: "consumerMatchIgnoreNotFound",
    label: "Ignore consumer not found",
    type: "bool",
  },
];

const TOKEN_EXCHANGE_FIELDS: EditFieldSpec[] = [
  { key: "clientId", label: "Client ID", type: "string" },
  {
    key: "tokenEndpoint",
    label: "Token endpoint",
    type: "string",
  },
];

const UP_SIGN: UpgradeSpec = {
  key: "sign",
  label: "Sign",
  description:
    "Add a digital signature to each request so the upstream can verify its origin and integrity.",
  fields: [
    {
      key: "alg",
      label: "Algorithm",
      type: "string",
      placeholder: "e.g. RS256",
    },
  ],
};
const UP_VERIFY: UpgradeSpec = {
  key: "verify",
  label: "Verify",
  description:
    "Verify the digital signature on incoming requests before they are forwarded.",
  fields: [],
};
const UP_COUNTER_SIGN: UpgradeSpec = {
  key: "counterSign",
  label: "Counter-sign",
  description:
    "Apply a second (counter) signature over the request in addition to the primary one.",
  fields: [
    {
      key: "signatureAlgorithm",
      label: "Signature algorithm",
      type: "string",
      placeholder: "e.g. RS256",
    },
  ],
};
const UP_TOKEN: UpgradeSpec = {
  key: "token",
  label: "Token",
  description:
    "Enforce OAuth token claims — allowed issuers / audience, scope, and consumer matching.",
  fields: TOKEN_FIELDS,
};
const UP_ACL: UpgradeSpec = {
  key: "acl",
  label: "ACL",
  description:
    "Apply an access-control list check on the connection.",
  fields: [],
};
const UP_TOKEN_EXCHANGE: UpgradeSpec = {
  key: "tokenExchange",
  label: "Token exchange",
  description:
    "Exchange the incoming token for a new token issued by another endpoint.",
  fields: TOKEN_EXCHANGE_FIELDS,
};
const UP_MTLS_AUTH: UpgradeSpec = {
  key: "mtlsAuth",
  label: "mTLS authentication",
  description:
    "Require mutual TLS authentication for the connection.",
  fields: [],
};
const UP_MTLS_ACL: UpgradeSpec = {
  key: "mtlsAcl",
  label: "mTLS ACL",
  description:
    "Restrict access based on the client's mTLS certificate.",
  fields: [],
};

const CLIENT_PATTERNS: PatternSpec[] = [
  {
    key: "sdx-p2p-consumer-access.r1",
    label: "Consumer access",
    description:
      "Baseline consumer access pattern. No additional properties.",
    fields: [],
    upgrades: [],
  },
  {
    key: "sdx-p2p-consumer.r1",
    label: "Consumer",
    description:
      "Consumer-side routing with optional request upgrades.",
    fields: [
      {
        key: "stripPath",
        label: "Strip path",
        type: "bool",
      },
    ],
    upgrades: [
      UP_SIGN,
      UP_VERIFY,
      UP_COUNTER_SIGN,
      UP_TOKEN,
      UP_ACL,
      UP_TOKEN_EXCHANGE,
    ],
  },
];

const SERVICE_PATTERNS: PatternSpec[] = [
  {
    key: "sdx-p2p-provider.r1",
    label: "Provider",
    description:
      "Provider-side routing to the upstream service with optional upgrades.",
    fields: [
      {
        key: "upstreamUrl",
        label: "Upstream URL",
        type: "string",
        placeholder: "https://…",
      },
    ],
    upgrades: [
      UP_MTLS_AUTH,
      UP_MTLS_ACL,
      UP_SIGN,
      UP_VERIFY,
      UP_COUNTER_SIGN,
      UP_TOKEN,
      UP_ACL,
      UP_TOKEN_EXCHANGE,
    ],
  },
];

function camelToSnake(k: string): string {
  return k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}

// Existing connections are read back in snake_case; the edit form works in
// camelCase. Try both spellings so pre-fill works regardless of which the API
// returns.
function pickKey(
  obj: Record<string, unknown> | undefined,
  key: string,
): unknown {
  if (!obj) return undefined;
  if (key in obj) return obj[key];
  const snake = camelToSnake(key);
  if (snake in obj) return obj[snake];
  return undefined;
}

function fieldDefaultString(
  obj: Record<string, unknown> | undefined,
  f: EditFieldSpec,
): string {
  const v = pickKey(obj, f.key);
  if (v == null) return "";
  if (f.type === "set" && Array.isArray(v))
    return v.map((x) => String(x)).join("\n");
  return String(v);
}

function EditFieldInput({
  field,
  source,
}: {
  field: EditFieldSpec;
  source?: Record<string, unknown>;
}) {
  if (field.type === "bool") {
    return (
      <label className="flex items-center gap-2 py-0.5">
        <input
          type="checkbox"
          data-field={field.key}
          data-field-type="bool"
          defaultChecked={Boolean(
            pickKey(source, field.key),
          )}
          className="rounded border-gray-300"
        />
        <span className="text-xs text-gray-700">
          {field.label}
        </span>
      </label>
    );
  }
  const value = fieldDefaultString(source, field);
  return (
    <label className="block py-0.5">
      <span className="block text-xs font-medium text-gray-600 mb-0.5">
        {field.label}
      </span>
      {field.type === "set" ? (
        <textarea
          data-field={field.key}
          data-field-type="set"
          defaultValue={value}
          rows={2}
          placeholder={field.placeholder}
          className="w-full text-xs font-mono border border-gray-300 rounded px-2 py-1"
        />
      ) : (
        <input
          type="text"
          data-field={field.key}
          data-field-type="string"
          defaultValue={value}
          placeholder={field.placeholder}
          className="w-full text-xs font-mono border border-gray-300 rounded px-2 py-1"
        />
      )}
      {field.hint && (
        <span className="block text-[11px] text-gray-400 mt-0.5">
          {field.hint}
        </span>
      )}
    </label>
  );
}

function UpgradeCard({
  upgrade,
  source,
}: {
  upgrade: UpgradeSpec;
  source?: Record<string, unknown>;
}) {
  const existing = pickKey(source, upgrade.key) as
    | Record<string, unknown>
    | undefined;
  const included = existing !== undefined;
  return (
    <div
      data-upgrade
      data-upgrade-key={upgrade.key}
      className="border border-gray-200 rounded-lg bg-white"
    >
      <label className="flex items-start gap-3 px-3 py-2 cursor-pointer">
        <input
          type="checkbox"
          data-upgrade-include
          defaultChecked={included}
          className="mt-0.5 rounded border-gray-300"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[#003366]">
            {upgrade.label}{" "}
            <span className="font-mono text-xs text-gray-400">
              {upgrade.key}
            </span>
          </span>
          <span className="block text-xs text-gray-500">
            {upgrade.description}
          </span>
        </span>
      </label>
      {upgrade.fields.length > 0 && (
        <div
          data-upgrade-body
          className={[
            "px-3 pb-3 pt-1 border-t border-gray-100 space-y-1",
            included ? "" : "hidden",
          ].join(" ")}
        >
          {upgrade.fields.map((f) => (
            <EditFieldInput
              key={f.key}
              field={f}
              source={existing}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PatternBlock({
  pattern,
  res,
  source,
}: {
  pattern: PatternSpec;
  res: "client" | "service";
  source?: Record<string, unknown>;
}) {
  const included = source !== undefined;
  const upgradesSource = pickKey(source, "upgrades") as
    | Record<string, unknown>
    | undefined;
  return (
    <div
      data-pattern
      data-res={res}
      data-pattern-key={pattern.key}
      className="border border-gray-200 rounded-lg overflow-hidden"
    >
      <label className="flex items-start gap-3 px-3 py-2 bg-gray-50 cursor-pointer">
        <input
          type="checkbox"
          data-pattern-include
          defaultChecked={included}
          className="mt-0.5 rounded border-gray-300"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[#003366]">
            {pattern.label}{" "}
            <span className="font-mono text-xs text-gray-400">
              {pattern.key}
            </span>
          </span>
          <span className="block text-xs text-gray-500">
            {pattern.description}
          </span>
        </span>
      </label>
      {(pattern.fields.length > 0 ||
        pattern.upgrades.length > 0) && (
        <div
          data-pattern-body
          className={[
            "px-3 py-3 space-y-3",
            included ? "" : "hidden",
          ].join(" ")}
        >
          {pattern.fields.length > 0 && (
            <div data-pattern-fields className="space-y-1">
              {pattern.fields.map((f) => (
                <EditFieldInput
                  key={f.key}
                  field={f}
                  source={source}
                />
              ))}
            </div>
          )}
          {pattern.upgrades.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Upgrades
              </div>
              {pattern.upgrades.map((u) => (
                <UpgradeCard
                  key={u.key}
                  upgrade={u}
                  source={upgradesSource}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditDialog({
  conn,
  org,
  dialogId,
}: {
  conn: ConnectionRequest;
  org: string;
  dialogId: string;
}) {
  const clientPatterns = (conn.clientResources
    ?.gatewayPatterns ?? {}) as unknown as Record<
    string,
    Record<string, unknown>
  >;
  const servicePatterns = (conn.serviceResources
    ?.gatewayPatterns ?? {}) as unknown as Record<
    string,
    Record<string, unknown>
  >;
  const subsystemId =
    conn.serviceResources?.subsystemId ?? "";
  return (
    <dialog
      id={dialogId}
      className="sdx-dialog sdx-dialog-wide"
    >
      <form
        method="post"
        action="/connections/edit"
        className="conn-edit-form"
      >
        <input type="hidden" name="org" value={org} />
        <input
          type="hidden"
          name="clientId"
          value={conn.clientId}
        />
        <input
          type="hidden"
          name="serviceId"
          value={conn.serviceId}
        />
        <input
          type="hidden"
          name="isApproved"
          value={conn.isApproved ? "true" : "false"}
        />
        <input
          type="hidden"
          name="payload"
          data-edit-payload
          defaultValue=""
        />

        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-[#003366]">
            Customize connection
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-[#003366] break-all">
            <span className="font-semibold">
              {conn.clientId}
            </span>
            <span className="text-gray-400">→</span>
            <span className="font-semibold">
              {conn.serviceId}
            </span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-auto">
          <label className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              data-active-toggle
              defaultChecked={Boolean(conn.isActive)}
              className="rounded border-gray-300"
            />
            <span>
              <span className="block text-sm font-semibold text-gray-800">
                Active
              </span>
              <span className="block text-xs text-gray-500">
                Whether this connection is enabled.
              </span>
            </span>
          </label>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Client resources
            </h3>
            {CLIENT_PATTERNS.map((p) => (
              <PatternBlock
                key={p.key}
                pattern={p}
                res="client"
                source={clientPatterns[p.key]}
              />
            ))}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Service resources
            </h3>
            {SERVICE_PATTERNS.map((p) => (
              <PatternBlock
                key={p.key}
                pattern={p}
                res="service"
                source={servicePatterns[p.key]}
              />
            ))}
          </section>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between gap-2">
          <button
            type="button"
            data-dialog-close
            className="text-sm font-semibold px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="text-sm font-semibold px-4 py-2 rounded bg-[#003366] text-white hover:bg-[#1a5276]"
          >
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ConnectionCard({
  conn,
  org,
  canApprove,
}: {
  conn: ConnectionRequest;
  org: string;
  canApprove: boolean;
}) {
  const destructiveAction = conn.isApproved
    ? {
        path: "/connections/revoke",
        label: "Revoke access",
        title: "Revoke access?",
        message:
          "This revokes the connection and deletes it. The client will lose access to the service.",
      }
    : {
        path: "/connections/delete",
        label: "Cancel request",
        title: "Cancel request?",
        message:
          "This withdraws the pending connection request.",
      };
  // The service provider (the org that owns the service) decides on a pending
  // request via the Approve/Reject review dialog.
  const isProviderPending = canApprove && !conn.isApproved;
  // Revoke/cancel deletes by connection id; only offer it when an id is present.
  const canDelete = Boolean(conn.id);
  const slug = (
    conn.clientId +
    "__" +
    conn.serviceId
  ).replace(/[^a-zA-Z0-9_-]/g, "_");
  const reviewId = `review-${slug}`;
  const confirmId = `confirm-${slug}`;
  const editId = `edit-${slug}`;
  const rd = conn.requesterDetails;
  const clientPatterns =
    conn.clientResources?.gatewayPatterns;
  const servicePatterns =
    conn.serviceResources?.gatewayPatterns;
  const subsystemId = conn.serviceResources?.subsystemId;
  const provisionerStatus = conn.provisionerStatus;
  const hasDetails = Boolean(
    rd ||
    clientPatterns ||
    servicePatterns ||
    subsystemId ||
    provisionerStatus ||
    (conn.scopes && conn.scopes.length > 0),
  );
  return (
    <article className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="font-mono text-sm text-gray-800 break-all">
            {conn.serviceId}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <StatusPill connection={conn} />
            {provisionerStatus && (
              <ProvisionerStatusPill
                status={provisionerStatus}
              />
            )}
            <SubmittedByBadge
              policyVersion={conn.policyVersion}
            />
            {rd?.requester && (
              <span className="text-xs text-gray-500">
                Requested by{" "}
                <span className="text-gray-700 font-medium">
                  {rd.requester}
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            data-dialog-open={editId}
            className="text-xs font-semibold px-3 py-1 rounded border border-[#003366] text-[#003366] hover:bg-blue-50"
          >
            Customize...
          </button>
          {isProviderPending ? (
            <button
              type="button"
              data-dialog-open={reviewId}
              className="text-xs font-semibold px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Approve / Reject
            </button>
          ) : (
            canDelete && (
              <button
                type="button"
                data-dialog-open={confirmId}
                className="text-xs font-semibold px-3 py-1 rounded border border-red-300 text-red-700 hover:bg-red-50"
              >
                {destructiveAction.label}
              </button>
            )
          )}
        </div>
      </div>

      {hasDetails && (
        <details className="border-t border-gray-100">
          <summary className="cursor-pointer list-none px-4 py-2 text-xs font-medium text-[#003366] hover:bg-gray-50 select-none">
            ▸ Connection details
          </summary>
          <div className="px-4 py-3 bg-gray-50/50 space-y-4 text-xs">
            {provisionerStatus && (
              <DetailSection title="Provisioner status">
                <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1">
                  <FieldRow
                    label="Status"
                    value={provisionerStatus.status}
                    mono
                  />
                  <FieldRow
                    label="Message"
                    value={provisionerStatus.message}
                  />
                  {provisionerStatus.endpoint && (
                    <>
                      <dt className="text-gray-500">
                        Endpoint
                      </dt>
                      <dd className="font-mono text-gray-800 break-all">
                        <a
                          href={provisionerStatus.endpoint}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#003366] underline hover:no-underline"
                        >
                          {provisionerStatus.endpoint}
                        </a>
                      </dd>
                    </>
                  )}
                  <FieldRow
                    label="Spec"
                    value={provisionerStatus.spec}
                    mono
                  />
                </dl>
              </DetailSection>
            )}

            {rd && (
              <DetailSection title="Requester details">
                <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1">
                  <FieldRow
                    label="Requester"
                    value={rd.requester}
                  />
                  <FieldRow
                    label="Submission ID"
                    value={rd.submissionId}
                    mono
                  />
                  <FieldRow
                    label="Client integration"
                    value={rd.client?.integrationId}
                    mono
                  />
                  <FieldRow
                    label="Client ID"
                    value={rd.client?.clientId}
                    mono
                  />
                  <FieldRow
                    label="Client zone"
                    value={rd.client?.privacyZone}
                    mono
                  />
                  <FieldRow
                    label="Service client"
                    value={rd.service?.clientId}
                    mono
                  />
                  <FieldRow
                    label="Service zone"
                    value={rd.service?.privacyZone}
                    mono
                  />
                </dl>
                <div className="mt-2">
                  <span className="text-gray-500">
                    Scopes{" "}
                  </span>
                  <ScopeChips scopes={rd.scopes} />
                </div>
              </DetailSection>
            )}

            {!rd &&
              conn.scopes &&
              conn.scopes.length > 0 && (
                <DetailSection title="Scopes">
                  <ScopeChips scopes={conn.scopes} />
                </DetailSection>
              )}

            {(clientPatterns ||
              subsystemId ||
              servicePatterns) && (
              <DetailSection title="Client resources">
                <GatewayPatterns
                  patterns={clientPatterns}
                />
              </DetailSection>
            )}

            {(servicePatterns || subsystemId) && (
              <DetailSection title="Service resources">
                {subsystemId && (
                  <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1 mb-2">
                    <FieldRow
                      label="subsystemId"
                      value={subsystemId}
                      mono
                    />
                  </dl>
                )}
                <GatewayPatterns
                  patterns={servicePatterns}
                />
              </DetailSection>
            )}
          </div>
        </details>
      )}

      <EditDialog conn={conn} org={org} dialogId={editId} />
      {isProviderPending && (
        <ReviewDialog
          conn={conn}
          org={org}
          dialogId={reviewId}
        />
      )}
      {!isProviderPending && canDelete && (
        <ConfirmDialog
          conn={conn}
          org={org}
          dialogId={confirmId}
          action={destructiveAction}
        />
      )}
    </article>
  );
}

function ConfirmDialog({
  conn,
  org,
  dialogId,
  action,
}: {
  conn: ConnectionRequest;
  org: string;
  dialogId: string;
  action: {
    path: string;
    label: string;
    title: string;
    message: string;
  };
}) {
  return (
    <dialog id={dialogId} className="sdx-dialog">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-[#003366]">
          {action.title}
        </h2>
      </div>
      <div className="px-5 py-4 space-y-3 text-sm">
        <p className="text-gray-600">{action.message}</p>
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm break-all">
          <span className="text-[#003366] font-semibold">
            {conn.clientId}
          </span>
          <span className="text-gray-400">→</span>
          <span className="text-[#003366] font-semibold">
            {conn.serviceId}
          </span>
        </div>
        <p className="text-xs text-gray-400">
          This action cannot be undone.
        </p>
      </div>
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between gap-2">
        <button
          type="button"
          data-dialog-close
          className="text-sm font-semibold px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-white"
        >
          Cancel
        </button>
        <form
          method="post"
          action={action.path}
          className="inline"
        >
          <input type="hidden" name="org" value={org} />
          <input
            type="hidden"
            name="id"
            value={conn.id ?? ""}
          />
          <input
            type="hidden"
            name="clientId"
            value={conn.clientId}
          />
          <input
            type="hidden"
            name="serviceId"
            value={conn.serviceId}
          />
          <button
            type="submit"
            className="text-sm font-semibold px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
          >
            {action.label}
          </button>
        </form>
      </div>
    </dialog>
  );
}

function ReviewDialog({
  conn,
  org,
  dialogId,
}: {
  conn: ConnectionRequest;
  org: string;
  dialogId: string;
}) {
  const rd = conn.requesterDetails;
  const scopes = rd?.scopes ?? conn.scopes;
  const hidden = (
    <>
      <input type="hidden" name="org" value={org} />
      <input
        type="hidden"
        name="id"
        value={conn.id ?? ""}
      />
      <input
        type="hidden"
        name="clientId"
        value={conn.clientId}
      />
      <input
        type="hidden"
        name="serviceId"
        value={conn.serviceId}
      />
    </>
  );
  return (
    <dialog id={dialogId} className="sdx-dialog">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="text-lg font-bold text-[#003366]">
          Review connection request
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          A consumer has requested access to a service you
          provide. Approve to grant access, or reject to
          remove the request.
        </p>
      </div>
      <div className="px-5 py-4 space-y-4 text-sm max-h-[60vh] overflow-auto">
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm break-all">
          <span className="text-[#003366] font-semibold">
            {conn.clientId}
          </span>
          <span className="text-gray-400">→</span>
          <span className="text-[#003366] font-semibold">
            {conn.serviceId}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill connection={conn} />
          {conn.environment && (
            <MetaBadge label={conn.environment} />
          )}
          {conn.policyVersion && (
            <MetaBadge
              label={`policy ${conn.policyVersion}`}
            />
          )}
        </div>
        {rd && (
          <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1 text-xs">
            <FieldRow
              label="Requester"
              value={rd.requester}
            />
            <FieldRow
              label="Submission ID"
              value={rd.submissionId}
              mono
            />
            <FieldRow
              label="Client integration"
              value={rd.client?.integrationId}
              mono
            />
            <FieldRow
              label="Client ID"
              value={rd.client?.clientId}
              mono
            />
            <FieldRow
              label="Client zone"
              value={rd.client?.privacyZone}
              mono
            />
            <FieldRow
              label="Service zone"
              value={rd.service?.privacyZone}
              mono
            />
          </dl>
        )}
        <div className="text-xs">
          <span className="text-gray-500">
            Scopes requested{" "}
          </span>
          <ScopeChips scopes={scopes} />
        </div>
      </div>
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between gap-2">
        <button
          type="button"
          data-dialog-close
          className="text-sm font-semibold px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-white"
        >
          Cancel
        </button>
        <div className="flex gap-2">
          <form
            method="post"
            action="/connections/reject"
            className="inline"
          >
            {hidden}
            <button
              type="submit"
              className="text-sm font-semibold px-4 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50"
            >
              Reject
            </button>
          </form>
          <form
            method="post"
            action="/connections/approve"
            className="inline"
          >
            {hidden}
            <button
              type="submit"
              className="text-sm font-semibold px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700"
            >
              Approve
            </button>
          </form>
        </div>
      </div>
    </dialog>
  );
}

function uniqueScopes(svc: Service): Scope[] {
  const byName = new Map<string, Scope>();
  for (const op of svc.operations) {
    for (const s of op.scopes ?? []) {
      if (!s || !s.name) continue;
      const existing = byName.get(s.name);
      // Keep the first description we encounter for a given scope name.
      if (!existing) byName.set(s.name, s);
      else if (!existing.description && s.description)
        byName.set(s.name, s);
    }
  }
  return [...byName.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

interface TreeServiceNode {
  serviceId: string;
  serviceTitle: string;
  serviceVersion: string;
  /** Best-effort SDX environment ("dev" | "test" | "prod"), or "" when unknown. */
  env: string;
  scopes: Scope[];
}

// Every service is published in exactly one environment. The catalog reports it
// explicitly; we keep that value (lower-cased) so environments without a
// dedicated filter tab — e.g. "lab", "sbx" — stay distinct tokens and get
// filtered out under the dev/test/prod tabs, while known synonyms ("uat",
// "sandbox", …) are normalised onto the canonical ids. We fall back to the
// identifiers embedded in the service (client id, name) only for payloads that
// predate the field.
function serviceEnv(svc: Service): string {
  if (svc.environment) {
    return (
      normalizeEnv(svc.environment) ??
      svc.environment.toLowerCase()
    );
  }
  return (
    normalizeEnv(svc.subsystem?.clientId) ??
    normalizeEnv(svc.name) ??
    ""
  );
}
interface TreeSubsystemNode {
  clientId: string;
  name: string;
  description?: string;
  services: TreeServiceNode[];
}
interface TreeOrgNode {
  orgName: string;
  orgTitle: string;
  subsystems: TreeSubsystemNode[];
}

function buildConnectionTree(
  services: Service[],
  subsystems: Subsystem[],
  organizations: Organization[],
): TreeOrgNode[] {
  const servicesByClient = new Map<string, Service[]>();
  for (const s of services) {
    const list =
      servicesByClient.get(s.subsystem.clientId) ?? [];
    list.push(s);
    servicesByClient.set(s.subsystem.clientId, list);
  }
  const subsystemsByOrgName = new Map<
    string,
    Subsystem[]
  >();
  for (const sub of subsystems) {
    const list =
      subsystemsByOrgName.get(sub.organization.name) ?? [];
    list.push(sub);
    subsystemsByOrgName.set(sub.organization.name, list);
  }
  const out: TreeOrgNode[] = [];
  for (const org of organizations) {
    const subs = subsystemsByOrgName.get(org.name) ?? [];
    const subNodes: TreeSubsystemNode[] = [];
    for (const sub of subs) {
      const svcs = servicesByClient.get(sub.clientId) ?? [];
      if (svcs.length === 0) continue;
      subNodes.push({
        clientId: sub.clientId,
        name: sub.name,
        description: sub.description,
        services: svcs
          .map((s) => ({
            serviceId: s.name,
            serviceTitle: s.title,
            serviceVersion: s.version,
            env: serviceEnv(s),
            scopes: uniqueScopes(s),
          }))
          .sort((a, b) =>
            a.serviceId.localeCompare(b.serviceId),
          ),
      });
    }
    if (subNodes.length === 0) continue;
    subNodes.sort((a, b) =>
      a.clientId.localeCompare(b.clientId),
    );
    out.push({
      orgName: org.name,
      orgTitle: org.title,
      subsystems: subNodes,
    });
  }
  out.sort((a, b) => a.orgTitle.localeCompare(b.orgTitle));
  return out;
}

function StepPill({
  stepId,
  displayNum,
  label,
  last,
}: {
  stepId: number;
  displayNum: number;
  label: string;
  last?: boolean;
}) {
  return (
    <li
      data-step-pill={String(stepId)}
      className="wiz-pill flex items-center gap-2 text-gray-500"
    >
      <span className="wiz-pill-num inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-gray-600 font-semibold">
        {displayNum}
      </span>
      <span className="wiz-pill-label">{label}</span>
      {!last && (
        <span className="text-gray-300 ml-1">›</span>
      )}
    </li>
  );
}

function AddConnectionWizard({
  selectedOrg,
  orgSubsystems,
  tree,
  defaultClientId,
}: {
  selectedOrg: Organization;
  orgSubsystems: Subsystem[];
  tree: TreeOrgNode[];
  defaultClientId?: string;
}) {
  const clientIds = orgSubsystems
    .slice()
    .sort((a, b) => a.clientId.localeCompare(b.clientId));
  const defaultSubsystem = defaultClientId
    ? orgSubsystems.find(
        (s) => s.clientId === defaultClientId,
      )
    : undefined;
  const hasDefault = !!defaultClientId;

  return (
    <dialog
      id="add-dialog"
      className="sdx-dialog sdx-dialog-wide"
      data-default-client-id={defaultClientId ?? ""}
    >
      <form
        method="post"
        action="/connections/add-multi"
        id="wiz-form"
      >
        <input
          type="hidden"
          name="org"
          value={selectedOrg.name}
        />
        <input
          type="hidden"
          name="clientId"
          id="wiz-client-id"
          value={defaultClientId ?? ""}
        />
        <input
          type="hidden"
          name="policyVersion"
          id="wiz-policy"
          value=""
        />
        <input
          type="hidden"
          name="selections"
          id="wiz-selections"
          value="[]"
        />

        <div className="px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-[#003366]">
            Request connections
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            <span className="text-gray-500">
              Organization:
            </span>{" "}
            <span className="text-gray-800 font-medium">
              {selectedOrg.title}
            </span>
            {defaultSubsystem && (
              <>
                <span className="mx-2 text-gray-300">
                  •
                </span>
                <span className="text-gray-500">
                  Subsystem:
                </span>{" "}
                <span className="text-gray-800 font-medium">
                  {defaultSubsystem.name}
                </span>
              </>
            )}
          </p>
          <ol className="mt-3 flex gap-2 text-xs">
            {!hasDefault && (
              <StepPill
                stepId={1}
                displayNum={1}
                label="Client"
              />
            )}
            <StepPill
              stepId={2}
              displayNum={hasDefault ? 1 : 2}
              label="Auth policy"
            />
            <StepPill
              stepId={3}
              displayNum={hasDefault ? 2 : 3}
              label="APIs & scopes"
            />
            <StepPill
              stepId={4}
              displayNum={hasDefault ? 3 : 4}
              label="Review"
              last
            />
          </ol>
        </div>

        {/* Step 1: client picker */}
        <div data-step="1" className="wiz-step px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Choose the client system requesting access
          </h3>
          {clientIds.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No subsystems registered for{" "}
              {selectedOrg.title}.
            </p>
          ) : (
            <ul className="max-h-[50vh] overflow-auto border border-gray-200 rounded divide-y divide-gray-100">
              {clientIds.map((s) => (
                <li key={s.clientId}>
                  <label className="flex items-start gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="wiz-client-radio"
                      value={s.clientId}
                      className="mt-1"
                    />
                    <span>
                      <span className="block font-mono text-sm text-[#003366]">
                        {s.clientId}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {s.name}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Step 2: auth policy */}
        <div
          data-step="2"
          className="wiz-step hidden px-5 py-4"
        >
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Choose the auth policy for this connection
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            SDX and Common SSO grant access to all
            operations on the selected service(s). Scoped
            access lets you request specific OAuth scopes.
          </p>
          <ul className="border border-gray-200 rounded divide-y divide-gray-100">
            <li>
              <label className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="wiz-policy-radio"
                  value="SDX.R0.00"
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    SDX{" "}
                    <span className="font-mono text-xs text-gray-400 font-normal">
                      SDX.R0.00
                    </span>
                  </span>
                  <span className="block text-xs text-gray-500">
                    Service-level access, no scopes.
                  </span>
                </span>
              </label>
            </li>
            <li>
              <label className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="wiz-policy-radio"
                  value="SDX.R1.00"
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    Common SSO{" "}
                    <span className="font-mono text-xs text-gray-400 font-normal">
                      SDX.R1.00
                    </span>
                  </span>
                  <span className="block text-xs text-gray-500">
                    Service-level access, no scopes.
                  </span>
                </span>
              </label>
            </li>
            <li>
              <label className="flex items-start gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="wiz-policy-radio"
                  value="SDX.R2.00"
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    Scoped access{" "}
                    <span className="font-mono text-xs text-gray-400 font-normal">
                      SDX.R2.00
                    </span>
                  </span>
                  <span className="block text-xs text-gray-500">
                    Request specific OAuth scopes for the
                    selected service(s).
                  </span>
                </span>
              </label>
            </li>
          </ul>
        </div>

        {/* Step 3: tree of APIs & scopes */}
        <div
          data-step="3"
          className="wiz-step hidden px-5 py-4"
        >
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Choose the APIs and scopes to request
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Checking an organization or subsystem selects
            everything beneath it. Uncheck individual scopes
            to narrow a request.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-600">
              Environment
            </span>
            <div
              role="tablist"
              aria-label="Environment"
              className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1"
            >
              <button
                type="button"
                role="tab"
                data-wiz-env-opt=""
                aria-selected="true"
                className="wiz-env-opt px-3 py-1 rounded-lg text-xs font-semibold transition-colors bg-white text-gray-900 shadow-sm"
              >
                All
              </button>
              {ENVIRONMENTS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  data-wiz-env-opt={e.id}
                  aria-selected="false"
                  className="wiz-env-opt px-3 py-1 rounded-lg text-xs font-semibold transition-colors text-gray-500 hover:text-gray-700"
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div className="wiz-tree border border-gray-200 rounded p-3 max-h-[55vh] overflow-auto">
            {tree.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No services available to request access to.
              </p>
            ) : (
              <ul>
                {tree.map((o) => (
                  <li
                    key={o.orgName}
                    className="wz-node"
                    data-node-type="org"
                    data-org={o.orgName}
                  >
                    <label className="wz-label">
                      <input
                        type="checkbox"
                        className="wz-cb"
                        data-node-type="org"
                        data-org={o.orgName}
                      />
                      <span className="font-semibold text-[#003366]">
                        {o.orgTitle}
                      </span>
                    </label>
                    <ul>
                      {o.subsystems.map((sub) => (
                        <li
                          key={sub.clientId}
                          className="wz-node"
                          data-node-type="subsystem"
                          data-subsystem={sub.clientId}
                        >
                          <label className="wz-label">
                            <input
                              type="checkbox"
                              className="wz-cb"
                              data-node-type="subsystem"
                              data-subsystem={sub.clientId}
                            />
                            <span className="text-sm text-gray-800">
                              {sub.name}
                            </span>
                          </label>
                          <ul>
                            {sub.services.map((svc) => (
                              <li
                                key={svc.serviceId}
                                className="wz-node"
                                data-node-type="service"
                                data-service={svc.serviceId}
                                data-subsystem={
                                  sub.clientId
                                }
                                data-env={svc.env}
                              >
                                <label className="wz-label">
                                  <input
                                    type="checkbox"
                                    className="wz-cb"
                                    data-node-type="service"
                                    data-service={
                                      svc.serviceId
                                    }
                                    data-subsystem={
                                      sub.clientId
                                    }
                                  />
                                  <span className="text-sm text-gray-800">
                                    {svc.serviceTitle} v
                                    {svc.serviceVersion}
                                  </span>
                                  {svc.env && (
                                    <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                      {svc.env}
                                    </span>
                                  )}
                                </label>
                                {svc.scopes.length > 0 && (
                                  <ul>
                                    {svc.scopes.map(
                                      (scope) => (
                                        <li
                                          key={scope.name}
                                          className="wz-node"
                                          data-node-type="scope"
                                          data-service={
                                            svc.serviceId
                                          }
                                          data-scope={
                                            scope.name
                                          }
                                        >
                                          <label className="wz-label">
                                            <input
                                              type="checkbox"
                                              className="wz-cb"
                                              data-node-type="scope"
                                              data-service={
                                                svc.serviceId
                                              }
                                              data-scope={
                                                scope.name
                                              }
                                            />
                                            <span className="font-mono text-xs text-purple-700">
                                              {scope.name}
                                            </span>
                                            {scope.description && (
                                              <span className="text-xs text-gray-500">
                                                {
                                                  scope.description
                                                }
                                              </span>
                                            )}
                                          </label>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                )}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Step 4: review */}
        <div
          data-step="4"
          className="wiz-step hidden px-5 py-4"
        >
          <h3 className="text-sm font-semibold text-gray-800 mb-2">
            Review the connection requests
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            The following connection requests will be
            created for{" "}
            <span
              id="wiz-review-client"
              className="font-mono text-[#003366]"
            >
              (client)
            </span>
            .
          </p>
          <div
            id="wiz-review"
            className="border border-gray-200 rounded p-3 max-h-[55vh] overflow-auto text-sm text-gray-500"
          >
            (Selections will appear here.)
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-between gap-2">
          <button
            type="button"
            data-close-dialog
            className="text-sm font-semibold px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-white"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              id="wiz-back"
              className="text-sm font-semibold px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-white"
            >
              Back
            </button>
            <button
              type="button"
              id="wiz-next"
              className="text-sm font-semibold px-4 py-2 rounded bg-[#003366] text-white hover:bg-[#1a5276]"
            >
              Next
            </button>
            <button
              type="submit"
              id="wiz-submit"
              className="text-sm font-semibold px-4 py-2 rounded bg-[#003366] text-white hover:bg-[#1a5276] hidden"
            >
              Submit
            </button>
          </div>
        </div>
      </form>
    </dialog>
  );
}

interface ClientGroup {
  clientId: string;
  subsystem: Subsystem | null;
  items: ConnectionRequest[];
}

function ClientGroupSection({
  group,
  org,
  ownedServiceIds,
}: {
  group: ClientGroup;
  org: string;
  ownedServiceIds: Set<string>;
}) {
  const { clientId, subsystem, items } = group;
  return (
    <section className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <header className="bg-gray-50 border-b border-gray-200 px-4 py-3">
        <h3 className="font-semibold text-[#003366] break-all">
          {clientId}
        </h3>
        {subsystem?.name && (
          <p className="text-xs text-gray-500">
            {subsystem.name}
          </p>
        )}
      </header>
      <div className="p-4 space-y-3">
        {items.map((conn) => (
          <ConnectionCard
            key={`${conn.clientId}:${conn.serviceId}`}
            conn={conn}
            org={org}
            canApprove={ownedServiceIds.has(conn.serviceId)}
          />
        ))}
      </div>
    </section>
  );
}

export function ConnectionsPage({
  organizations,
  selectedOrg,
  connections,
  orgSubsystems,
  allSubsystems,
  services,
  config: _config,
  currentPath,
  user,
  flash,
  error,
}: ConnectionsPageProps) {
  const ownedServiceIds = new Set<string>(
    selectedOrg
      ? services
          .filter(
            (s) =>
              s.subsystem.organization.name ===
              selectedOrg.name,
          )
          .map((s) => s.name)
      : [],
  );
  const connectionTree = selectedOrg
    ? buildConnectionTree(
        services,
        allSubsystems,
        organizations,
      )
    : [];

  // Group every connection by its client (always), regardless of whether the
  // client subsystem belongs to the selected organization.
  const subByClientId = new Map<string, Subsystem>();
  for (const s of allSubsystems)
    subByClientId.set(s.clientId, s);

  const byClient = new Map<string, ConnectionRequest[]>();
  for (const c of connections) {
    const list = byClient.get(c.clientId) ?? [];
    list.push(c);
    byClient.set(c.clientId, list);
  }
  const groups: ClientGroup[] = [...byClient.entries()]
    .map(([clientId, items]) => ({
      clientId,
      subsystem: subByClientId.get(clientId) ?? null,
      items: items
        .slice()
        .sort((a, b) =>
          a.serviceId.localeCompare(b.serviceId),
        ),
    }))
    .sort((a, b) => a.clientId.localeCompare(b.clientId));

  const breadcrumbItems: Crumb[] = [
    { label: "Home", href: "/" },
    { label: "Member Console", href: "/console" },
    {
      label: "Connection Requests",
      menu: CONSOLE_PAGES.filter(
        (p) => p.href !== "/connections",
      ),
    },
  ];
  if (selectedOrg)
    breadcrumbItems.push({ label: selectedOrg.title });

  return (
    <Layout
      title="Connection Requests"
      currentPath={currentPath}
      user={user}
    >
      <style
        dangerouslySetInnerHTML={{ __html: DIALOG_STYLE }}
      />

      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-3xl font-bold mb-2">
            Connection Requests
          </h1>
          <p className="text-blue-200">
            Connection requests for an organization member,
            grouped by subsystem — each subsystem appears
            where it is the client or the service provider.
          </p>
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      {/* Picker */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <OrgPicker
            organizations={organizations}
            selectedOrg={selectedOrg}
            action="/connections"
            submitLabel="Load connections"
            autoSubmit
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {flash && (
          <div
            className={[
              "mb-4 rounded border px-4 py-3 text-sm",
              flash.kind === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800",
            ].join(" ")}
          >
            {flash.message}
          </div>
        )}
        {error && !flash && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {!selectedOrg ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600">
              Select an organization member above to view
              its connections.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <h2 className="text-2xl font-bold text-[#003366]">
                  {selectedOrg.title}
                </h2>
                <p className="text-xs text-gray-500 font-mono">
                  {selectedOrg.member.memberClass}/
                  {selectedOrg.member.memberId}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  {connections.length} connection
                  {connections.length === 1 ? "" : "s"}{" "}
                  across {groups.length} client
                  {groups.length === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  data-open-dialog="add-dialog"
                  className="bg-[#003366] text-white text-sm font-semibold px-4 py-2 rounded hover:bg-[#1a5276]"
                >
                  + Add connection
                </button>
              </div>
            </div>

            {connections.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-600">
                  No connections yet for this organization.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groups.map((group) => (
                  <ClientGroupSection
                    key={group.clientId}
                    group={group}
                    org={selectedOrg.name}
                    ownedServiceIds={ownedServiceIds}
                  />
                ))}
              </div>
            )}

            <AddConnectionWizard
              selectedOrg={selectedOrg}
              orgSubsystems={orgSubsystems}
              tree={connectionTree}
            />
          </>
        )}
      </div>

      <script
        dangerouslySetInnerHTML={{ __html: DIALOG_SCRIPT }}
      />
      <script
        dangerouslySetInnerHTML={{ __html: WIZARD_SCRIPT }}
      />
      <script
        dangerouslySetInnerHTML={{ __html: EDIT_SCRIPT }}
      />
    </Layout>
  );
}
