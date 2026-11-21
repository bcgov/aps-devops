import { CHART_JS_URL } from "../components/custom/TimeSeriesChart.tsx";
import { OverflowActions } from "../components/OverflowActions.tsx";
import { ClientSubsystemLink, DetailSection, FieldRow, ProvisionerStatusDetails, ScopeChips } from "../components/ConnectionDetails.tsx";
import { Layout } from "../components/Layout.tsx";
import { Btn } from "../components/Btn.tsx";
import {
  Breadcrumb,
  type Crumb,
} from "../components/custom/Breadcrumb.tsx";
import { OrgPicker } from "../components/custom/OrgPicker.tsx";
import type {
  ConnectionGatewayPattern,
  ConnectionRequest,
  Organization,
  Service,
  SiteConfig,
  Subsystem,
} from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface ConnectionsPageProps {
  organizations: Organization[];
  selectedOrg: Organization | null;
  connections: ConnectionRequest[];
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

type StatusIconName = "ready" | "info" | "clock";

function StatusIcon({ name }: { name: StatusIconName }) {
  const paths = {
    ready: "m5 8 2 2 4-4",
    info: "M8 7.5v3.5M8 5v.25",
    clock: "M8 4.5V8l2 1.5",
  };
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d={paths[name]} />
    </svg>
  );
}

function StatusPopover({
  label,
  trigger,
  className,
  children,
}: {
  label?: string;
  trigger: React.ReactNode;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <details data-status-popover="" className="relative">
      <summary
        aria-label={label}
        className={`inline-flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden ${className}`}
      >
        {trigger}
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-56 max-w-[80vw] rounded-lg border border-border bg-white p-3 text-xs text-ink shadow-lg">
        {children}
      </div>
    </details>
  );
}

function StatusLegend() {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
      Connection statuses
      <StatusPopover
        label="About connection statuses"
        trigger="?"
        className="h-5 w-5 justify-center rounded-full border border-border text-bc-blue"
      >
        <dl className="space-y-2">
          <div><dt className="font-semibold">Ready</dt><dd>The client can call the service.</dd></div>
          <div><dt className="font-semibold">Not ready</dt><dd>Open the badge to see why the client can’t call the service.</dd></div>
          <div><dt className="font-semibold">Changes pending approval</dt><dd>A proposed change is awaiting review.</dd></div>
        </dl>
      </StatusPopover>
    </div>
  );
}

const STATUS_PILL = "rounded-full px-2.5 py-1 text-sm font-semibold";

function ConnectionStatus({
  connection,
  hasProposal = false,
}: {
  connection: ConnectionRequest;
  hasProposal?: boolean;
}) {
  const provisioner = connection.provisionerStatus;
  const isProvisioned = provisioner?.status === "provisioned";
  const isReady = connection.isActive && connection.isApproved && isProvisioned;
  const reasons: string[] = [];

  if (!connection.isApproved) {
    reasons.push("Initial request is awaiting approval");
  } else if (!connection.isActive) {
    reasons.push("Connection is inactive");
  }

  if (provisioner?.status === "failed") {
    reasons.push(provisioner.operation === "deprovision"
      ? "Couldn't remove access configuration"
      : "Provisioning failed");
  } else if (provisioner?.status === "deprovisioning") {
    reasons.push("Removing access configuration");
  } else if (connection.isApproved && provisioner?.status === "pending") {
    reasons.push("Provisioning is in progress");
  } else if (connection.isApproved && connection.isActive && !isProvisioned) {
    reasons.push(provisioner?.status === "deprovisioned"
      ? "Access configuration has been removed"
      : "Provisioning has not completed");
  }

  return (
    <>
      {isReady ? (
        <span className={`inline-flex items-center gap-1 bg-support-success-bg text-support-success-border ${STATUS_PILL}`}>
          <StatusIcon name="ready" /> Ready
        </span>
      ) : (
        <StatusPopover
          trigger={
            <>
              <StatusIcon name="info" /> Not ready
              <span aria-hidden="true" className="text-xs">▾</span>
            </>
          }
          className={`border border-border bg-surface-muted text-ink hover:bg-gray-100 ${STATUS_PILL}`}
        >
          <ul className={reasons.length > 1 ? "list-disc space-y-1 pl-4" : undefined}>
            {reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </StatusPopover>
      )}
      {hasProposal && (
        <StatusPopover
          trigger={<><StatusIcon name="clock" /> Changes pending approval</>}
          className={`bg-support-warning-bg text-ink ${STATUS_PILL}`}
        >
          {isReady
            ? "Current access is still available while these changes await approval."
            : "A proposed change is awaiting approval."}
        </StatusPopover>
      )}
    </>
  );
}

const DIALOG_STYLE = `
dialog.sdx-dialog { border: none; border-radius: var(--layout-border-radius-large); padding: 0; max-width: 560px; width: 92%; box-shadow: var(--surface-shadow-large); }
dialog.sdx-dialog.sdx-dialog-wide { max-width: 760px; }
dialog.sdx-dialog::backdrop { background: var(--surface-color-overlay-default); }
`;

const AGREEMENT_TRAFFIC_SCRIPT = await Deno.readTextFile(
  new URL("../public/agreement-traffic.js", import.meta.url),
);

const DIALOG_SCRIPT = `
(function(){
  // Handle the click before the hydrated design-system button handles the press.
  document.addEventListener('click', function(e){
    document.querySelectorAll('[data-overflow-actions][open], [data-status-popover][open]').forEach(function(menu){
      if (menu.matches('[data-status-popover]') ? !menu.contains(e.target) :
        !menu.querySelector('summary').contains(e.target)) menu.open = false;
    });
    var agreement = e.target.closest && e.target.closest('[data-agreement-url]');
    if (agreement) {
      e.preventDefault();
      openConnectionAgreement(agreement.getAttribute('data-agreement-url'));
      return;
    }
    var o = e.target.closest && e.target.closest('[data-dialog-open]');
    if (o) {
      e.preventDefault();
      var d = document.getElementById(o.getAttribute('data-dialog-open'));
      if (d && !d.open) {
        if (typeof d.showModal === 'function') d.showModal();
        else d.setAttribute('open','');
      }
      return;
    }
    var c = e.target.closest && e.target.closest('[data-dialog-close]');
    if (c) {
      e.preventDefault();
      var dd = c.closest('dialog');
      if (dd) { if (typeof dd.close === 'function') dd.close(); else dd.removeAttribute('open'); }
    }
  }, true);
  document.addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    var menu = e.target.closest('[data-overflow-actions][open], [data-status-popover][open]');
    if (!menu) return;
    menu.open = false;
    menu.querySelector('summary').focus();
  });
})();
`;

// Drives the Edit connection dialog(s): show/hide the property panels as
// include toggles flip, and — on save — walk the form to assemble the
// clientResources/serviceResources payload into a hidden input so the
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
    var subEl = f.querySelector('[data-subsystem-id]');
    var sub = subEl ? (subEl.value||'').trim() : '';
    var clientComment = (f.querySelector('[data-comment-field][data-res="client"]')||{}).value || '';
    var serviceComment = (f.querySelector('[data-comment-field][data-res="service"]')||{}).value || '';
    var servicePatterns = buildPatterns(f, 'service');
    var serviceResources;
    if (sub || serviceComment.trim() || Object.keys(servicePatterns).length) {
      serviceResources = { gatewayPatterns: servicePatterns };
      if (sub) serviceResources.subsystemId = sub;
      if (serviceComment.trim()) serviceResources.comment = serviceComment.trim();
    }
    var clientResources = { gatewayPatterns: buildPatterns(f, 'client') };
    if (clientComment.trim()) clientResources.comment = clientComment.trim();
    var payload = {
      clientResources: clientResources,
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
    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-surface-muted text-ink-secondary font-mono">
      {label}
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
  const selected = { ...upgrades };
  const flags = [
    UP_SIGN,
    UP_VERIFY,
    UP_COUNTER_SIGN,
    UP_ACL,
    UP_MTLS_AUTH,
    UP_MTLS_ACL,
  ].filter(({ key }) => pickKey(selected, key));
  const token = upgrades.token;
  const tx = pickKey(selected, UP_TOKEN_EXCHANGE.key) as
    | typeof upgrades.token_exchange;
  if (flags.length === 0 && !token && !tx) return null;

  const pillClass =
    "inline-flex items-center whitespace-nowrap rounded-full border border-border bg-surface-blue-tint px-3 py-1 text-xs font-semibold leading-tight text-bc-blue";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-ink-secondary">
        Upgrades:
      </span>
      {flags.map(({ key, label }) => (
        <div key={key} className={pillClass}>
          {label}
        </div>
      ))}
      {token && (
        <details className="relative">
          <summary className={pillClass + " cursor-pointer list-none"}>
            Token
          </summary>
          <div className="absolute z-10 mt-1 w-40 space-y-1 rounded-lg border border-border bg-surface-muted p-2 break-words">
            <dl className="grid gap-y-0.5">
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
        </details>
      )}
      {tx && (
        <details className="relative">
          <summary className={pillClass + " cursor-pointer list-none"}>
            Token exchange
          </summary>
          <div className="absolute z-10 mt-1 w-40 space-y-1 rounded-lg border border-border bg-surface-muted p-2 break-words">
            <dl className="grid gap-y-0.5">
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
              <span className="text-ink-secondary">scopes</span>
              <ScopeChips scopes={tx.scopes} />
            </div>
          </div>
        </details>
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
      <p className="text-ink-placeholder italic">
        No gateway patterns.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {entries.map(([name, p]) => (
        <div
          key={name}
          className="border border-border rounded bg-white"
        >
          <div className="px-3 py-1.5 bg-surface-muted border-b border-border font-mono text-xs text-bc-blue">
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
              <FieldRow
                label="tls_verify"
                value={p.tls_verify}
                mono
              />
              <FieldRow
                label="client_runtime_override"
                value={p.client_runtime_override}
                mono
              />
              <FieldRow
                label="integration_client_id"
                value={p.integration_client_id}
                mono
              />
              <FieldRow
                label="use_sni"
                value={p.use_sni}
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

/** policyVersion identifies the submission channel ("Submitted by"). */
function submittedByLabel(policyVersion?: string): {
  label: string;
  cls: string;
} | null {
  if (!policyVersion) return null;
  if (policyVersion === "SDX.R0.00")
    return {
      label: "SDX",
      cls: "bg-surface-blue-tint text-bc-blue border-border",
    };
  if (policyVersion === "SDX.R1.00")
    return {
      label: "Common SSO",
      cls: "bg-white text-ink border-border-dark",
    };
  return {
    label: policyVersion,
    cls: "bg-surface-muted text-ink-secondary border-border",
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
  {
    key: "audience",
    label: "Audience",
    type: "string",
  },
  {
    key: "scopes",
    label: "Scopes",
    type: "set",
    placeholder: "one scope per line",
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
      "Baseline consumer access pattern.",
    fields: [
      {
        key: "integrationClientId",
        label: "Integration client ID",
        type: "string",
      },
    ],
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
      {
        key: "tlsVerify",
        label: "TLS verify",
        type: "string",
      },
      {
        key: "clientRuntimeOverride",
        label: "Client runtime override",
        type: "string",
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
        key: "clientRuntimeOverride",
        label: "Client runtime override",
        type: "string"
      },
      {
        key: "upstreamUrl",
        label: "Upstream URL",
        type: "string",
        placeholder: "https://…",
      },
      {
        key: "useSni",
        label: "Use SNI",
        type: "string",
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
  return obj[snake.replaceAll("_", "-")];
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
          className="rounded border-border"
        />
        <span className="text-xs text-ink-secondary">
          {field.label}
        </span>
      </label>
    );
  }
  const value = fieldDefaultString(source, field);
  return (
    <label className="block py-0.5">
      <span className="block text-xs font-medium text-ink-secondary mb-0.5">
        {field.label}
      </span>
      {field.type === "set" ? (
        <textarea
          data-field={field.key}
          data-field-type="set"
          defaultValue={value}
          rows={2}
          placeholder={field.placeholder}
          className="w-full text-xs font-mono border border-border rounded px-2 py-1"
        />
      ) : (
        <input
          type="text"
          data-field={field.key}
          data-field-type="string"
          defaultValue={value}
          placeholder={field.placeholder}
          className="w-full text-xs font-mono border border-border rounded px-2 py-1"
        />
      )}
      {field.hint && (
        <span className="block text-[11px] text-ink-placeholder mt-0.5">
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
      className="border border-border rounded-lg bg-white"
    >
      <label className="flex items-start gap-3 px-3 py-2 cursor-pointer">
        <input
          type="checkbox"
          data-upgrade-include
          defaultChecked={included}
          className="mt-0.5 rounded border-border"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-bc-blue">
            {upgrade.label}{" "}
            <span className="font-mono text-xs text-ink-placeholder">
              {upgrade.key}
            </span>
          </span>
          <span className="block text-xs text-ink-secondary">
            {upgrade.description}
          </span>
        </span>
      </label>
      {upgrade.fields.length > 0 && (
        <div
          data-upgrade-body
          className={[
            "px-3 pb-3 pt-1 border-t border-border space-y-1",
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
      className="border border-border rounded-lg overflow-hidden"
    >
      <label className="flex items-start gap-3 px-3 py-2 bg-surface-muted cursor-pointer">
        <input
          type="checkbox"
          data-pattern-include
          defaultChecked={included}
          className="mt-0.5 rounded border-border"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-bc-blue">
            {pattern.label}{" "}
            <span className="font-mono text-xs text-ink-placeholder">
              {pattern.key}
            </span>
          </span>
          <span className="block text-xs text-ink-secondary">
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
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
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
          name="payload"
          data-edit-payload
          defaultValue=""
        />

        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-bc-blue">
            Customize connection
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-bc-blue break-all">
            <span className="font-semibold">
              {conn.clientId}
            </span>
            <span className="text-ink-placeholder">→</span>
            <span className="font-semibold">
              {conn.serviceId}
            </span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-auto">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Client resources
            </h3>
            <label className="block py-0.5">
              <span className="block text-xs font-medium text-ink-secondary mb-0.5">
                Comment
              </span>
              <input
                type="text"
                data-comment-field
                data-res="client"
                defaultValue={
                  conn.clientResources?.comment ?? ""
                }
                className="w-full text-xs font-mono border border-border rounded px-2 py-1"
              />
            </label>
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
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              Service resources
            </h3>
            <label className="block py-0.5">
              <span className="block text-xs font-medium text-ink-secondary mb-0.5">
                Comment
              </span>
              <input
                type="text"
                data-comment-field
                data-res="service"
                defaultValue={
                  conn.serviceResources?.comment ?? ""
                }
                className="w-full text-xs font-mono border border-border rounded px-2 py-1"
              />
            </label>
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

        <div className="px-5 py-3 bg-surface-muted border-t border-border flex justify-end gap-2">
          <Btn variant="secondary" data={{ "dialog-close": "" }}>
            Cancel
          </Btn>
          <Btn type="submit">Save</Btn>
        </div>
      </form>
    </dialog>
  );
}

function LifecycleForm({
  conn,
  org,
  action,
  label,
}: {
  conn: ConnectionRequest;
  org: string;
  action: "activate" | "deactivate" | "retry";
  label: string;
}) {
  return (
    <form method="post" action="/connections/lifecycle" className="inline">
      <input type="hidden" name="org" value={org} />
      <input type="hidden" name="id" value={conn.id ?? ""} />
      <input type="hidden" name="clientId" value={conn.clientId} />
      <input type="hidden" name="serviceId" value={conn.serviceId} />
      <input type="hidden" name="action" value={action} />
      <Btn type="submit" size="small">
        {label}
      </Btn>
    </form>
  );
}

export function ConnectionCard({
  conn,
  org,
  canApprove,
}: {
  conn: ConnectionRequest;
  org: string;
  canApprove: boolean;
}) {
  const proposal = conn.proposedConfiguration;
  const hasProposal = Boolean(proposal && Object.keys(proposal).length > 0);
  const destructiveAction = conn.isApproved
    ? {
        path: "/connections/revoke",
        label: "Revoke access",
        title: "Revoke access?",
        message:
          "This removes access configuration and permanently deletes the connection. The client will lose access to the service.",
      }
    : {
        path: "/connections/delete",
        label: "Cancel request",
        title: "Cancel request?",
        message: "This withdraws the pending connection request.",
      };
  const isProviderPending = canApprove && (!conn.isApproved || hasProposal);
  const hasId = Boolean(conn.id);
  const slug = (conn.clientId + "__" + conn.serviceId)
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const agreementQuery = new URLSearchParams({
    org,
    clientId: conn.clientId,
    serviceId: conn.serviceId,
  });
  if (conn.id) agreementQuery.set("id", conn.id);
  const reviewId = `review-${slug}`;
  const confirmId = `confirm-${slug}`;
  const abandonId = `abandon-revoke-${slug}`;
  const editId = `edit-${slug}`;
  const rd = conn.requesterDetails;
  const clientPatterns = conn.clientResources?.gatewayPatterns;
  const servicePatterns = conn.serviceResources?.gatewayPatterns;
  const subsystemId = conn.serviceResources?.subsystemId;
  const provisionerStatus = conn.provisionerStatus;
  const lifecycleIntent = conn.lifecycleIntent;
  const busy = provisionerStatus?.status === "pending" ||
    provisionerStatus?.status === "deprovisioning";
  const revokePending = lifecycleIntent?.action === "revoke";
  const backendActions = conn.lifecycleActions;
  const allowed = (
    action: "activate" | "deactivate" | "retry" | "revoke",
    compatibilityFallback: boolean,
  ) => backendActions
    ? backendActions[action]?.allowed === true
    : compatibilityFallback;
  const canRetry = Boolean(
    hasId &&
      allowed(
        "retry",
        Boolean(
          conn.isApproved &&
            !busy &&
            (provisionerStatus?.status === "failed" ||
              (revokePending && provisionerStatus?.status === "deprovisioned")),
        ),
      ),
  );
  const canActivate = Boolean(
    hasId &&
      allowed(
        "activate",
        Boolean(conn.isApproved && !conn.isActive && !busy),
      ),
  );
  const activateRequiresConfirmation = Boolean(
    backendActions?.activate?.requiresConfirmation ?? revokePending,
  );
  const canDeactivate = Boolean(
    hasId &&
      allowed(
        "deactivate",
        Boolean(conn.isApproved && conn.isActive && !busy && !revokePending),
      ),
  );
  const canRevoke = Boolean(
    hasId &&
      allowed(
        "revoke",
        Boolean(conn.isApproved && !busy && !revokePending),
      ),
  );
  const canCancel = Boolean(!conn.isApproved && hasId);
  const hasDetails = Boolean(
    rd ||
      clientPatterns ||
      servicePatterns ||
      subsystemId ||
      provisionerStatus ||
      hasProposal ||
      lifecycleIntent ||
      (conn.scopes && conn.scopes.length > 0),
  );
  const retryLabel = revokePending ? "Retry revoke" : "Retry";
  const retryAction = {
    label: retryLabel,
    control: (
      <LifecycleForm conn={conn} org={org} action="retry" label={retryLabel} />
    ),
  };
  const [primaryAction, ...otherPrimaryActions] = [
    isProviderPending && {
      label: hasProposal ? "Review changes" : "Approve / Reject",
      control: (
        <Btn size="small" data={{ "dialog-open": reviewId }}>
          {hasProposal ? "Review changes" : "Approve / Reject"}
        </Btn>
      ),
    },
    (canRevoke || canCancel) && {
      label: destructiveAction.label,
      control: (
        <Btn size="small" variant="secondary" danger data={{ "dialog-open": confirmId }}>
          {destructiveAction.label}
        </Btn>
      ),
    },
    canRetry && provisionerStatus?.status !== "failed" && retryAction,
  ].filter((action) => action !== false);
  const additionalActions = [
    ...otherPrimaryActions,
    canActivate && !activateRequiresConfirmation && {
      label: "Activate",
      control: (
        <LifecycleForm conn={conn} org={org} action="activate" label="Activate" />
      ),
    },
    canActivate && activateRequiresConfirmation && {
      label: "Activate",
      control: (
        <button
          type="button"
          data-dialog-open={abandonId}
          className="text-xs font-semibold px-3 py-1 rounded bg-btn-secondary border border-border-dark text-ink hover:bg-btn-secondary-hover"
        >
          Activate
        </button>
      ),
    },
    canDeactivate && {
      label: "Deactivate",
      control: (
        <LifecycleForm conn={conn} org={org} action="deactivate" label="Deactivate" />
      ),
    },
    {
      label: "Customize...",
      control: (
        <button
          type="button"
          data-dialog-open={editId}
          className="text-xs font-semibold px-3 py-1 rounded bg-btn-secondary border border-border-dark text-ink hover:bg-btn-secondary-hover"
        >
          Customize...
        </button>
      ),
    },
    {
      label: "ISA",
      control: <Btn size="small" variant="secondary" data={{ "agreement-url": `/api/connections/agreement?${agreementQuery}` }}>ISA</Btn>,
    },
  ].filter((action) => action !== false);
  return (
    <article className="bg-white border border-border rounded-lg">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-mono text-sm text-ink break-all">
              {conn.serviceId}
            </div>
            <ConnectionStatus connection={conn} hasProposal={hasProposal} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <SubmittedByBadge
              policyVersion={conn.policyVersion}
            />
            {rd?.requester && (
              <span className="text-xs text-ink-secondary">
                Requested by{" "}
                <span className="text-ink-secondary font-medium">
                  {rd.requester}
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {canRetry && provisionerStatus?.status === "failed" &&
            retryAction.control}
          {primaryAction?.control ?? (
            busy && conn.isApproved && (
              <Btn size="small" variant="secondary" disabled>
                Lifecycle action in progress
              </Btn>
            )
          )}
          <OverflowActions id={`actions-${editId}`} actions={additionalActions} />
        </div>
      </div>

      {hasDetails && (
        <details className="border-t border-border">
          <summary className="cursor-pointer list-none px-4 py-2 text-xs font-medium text-bc-blue hover:bg-surface-muted select-none">
            ▸ Connection details
          </summary>
          <div className="px-4 py-3 bg-surface-muted space-y-4 text-xs">
            {provisionerStatus && (
              <ProvisionerStatusDetails status={provisionerStatus} />
            )}

            {proposal && (
              <DetailSection title="Pending proposed changes">
                <p className="mb-3 text-ink-secondary">
                  Consumer-revoked scopes are applied immediately. Only added
                  scopes and other proposed changes await provider approval.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded border border-border bg-white p-3 space-y-2">
                    <div className="font-semibold text-ink">Currently approved</div>
                    <FieldRow label="Service version" value={rd?.service?.version} mono />
                    <div><span className="text-ink-secondary">Scopes </span><ScopeChips scopes={rd?.scopes ?? conn.scopes} /></div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all text-[11px]">{JSON.stringify({ clientResources: conn.clientResources, serviceResources: conn.serviceResources }, null, 2)}</pre>
                  </div>
                  <div className="rounded border border-support-warning-border bg-support-warning-bg p-3 space-y-2">
                    <div className="font-semibold text-ink">Proposed</div>
                    <FieldRow label="Service version" value={proposal.requesterDetails?.service?.version} mono />
                    <div><span className="text-ink-secondary">Scopes </span><ScopeChips scopes={proposal.requesterDetails?.scopes} /></div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all text-[11px]">{JSON.stringify({ clientResources: proposal.clientResources, serviceResources: proposal.serviceResources }, null, 2)}</pre>
                  </div>
                </div>
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
                    label="Requester email"
                    value={rd.requesterEmail}
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
                  <span className="text-ink-secondary">
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
                {conn.clientResources?.comment && (
                  <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1 mb-2">
                    <FieldRow
                      label="comment"
                      value={conn.clientResources.comment}
                    />
                  </dl>
                )}
                <GatewayPatterns
                  patterns={clientPatterns}
                />
              </DetailSection>
            )}

            {(servicePatterns || subsystemId) && (
              <DetailSection title="Service resources">
                {(subsystemId ||
                  conn.serviceResources?.comment) && (
                  <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1 mb-2">
                    <FieldRow
                      label="subsystemId"
                      value={subsystemId}
                      mono
                    />
                    <FieldRow
                      label="comment"
                      value={conn.serviceResources?.comment}
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
      {(canRevoke || canCancel) && (
        <ConfirmDialog
          conn={conn}
          org={org}
          dialogId={confirmId}
          action={destructiveAction}
        />
      )}
      {canActivate && activateRequiresConfirmation && (
        <ConfirmDialog
          conn={conn}
          org={org}
          dialogId={abandonId}
          action={{
            path: "/connections/lifecycle",
            label: "Activate",
            title: "Abandon revoke and activate?",
            message: backendActions?.activate?.message ??
              "The failed revoke will be abandoned and the approved connection will be provisioned again.",
            lifecycleAction: "activate",
            confirmAbandonRevoke: true,
            reversible: true,
          }}
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
    lifecycleAction?: "activate" | "deactivate" | "retry" | "revoke";
    confirmAbandonRevoke?: boolean;
    reversible?: boolean;
  };
}) {
  return (
    <dialog id={dialogId} className="sdx-dialog">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-lg font-bold text-bc-blue">
          {action.title}
        </h2>
      </div>
      <div className="px-5 py-4 space-y-3 text-sm">
        <p className="text-ink-secondary">{action.message}</p>
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm break-all">
          <span className="text-bc-blue font-semibold">
            {conn.clientId}
          </span>
          <span className="text-ink-placeholder">→</span>
          <span className="text-bc-blue font-semibold">
            {conn.serviceId}
          </span>
        </div>
        {!action.reversible && (
          <p className="text-xs text-ink-placeholder">
            This action cannot be undone.
          </p>
        )}
      </div>
      <div className="px-5 py-3 bg-surface-muted border-t border-border flex justify-end gap-2">
        <Btn variant="secondary" data={{ "dialog-close": "" }}>
          Cancel
        </Btn>
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
          {action.lifecycleAction && (
            <input type="hidden" name="action" value={action.lifecycleAction} />
          )}
          {action.confirmAbandonRevoke && (
            <input type="hidden" name="confirmAbandonRevoke" value="true" />
          )}
          <Btn type="submit" danger={!action.reversible}>{action.label}</Btn>
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
  const proposal = conn.proposedConfiguration;
  const hasProposal = Boolean(proposal && Object.keys(proposal).length > 0);
  const rd = proposal?.requesterDetails ?? conn.requesterDetails;
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
      <input type="hidden" name="hasProposal" value={hasProposal ? "true" : "false"} />
    </>
  );
  return (
    <dialog id={dialogId} className="sdx-dialog">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-lg font-bold text-bc-blue">
          {hasProposal ? "Review proposed changes" : "Review connection request"}
        </h2>
        <p className="text-xs text-ink-secondary mt-1">
          {hasProposal
            ? "Consumer-revoked scopes have already been applied. Approve to apply the remaining proposal. Reject to discard it and keep the current access shown below."
            : "A consumer has requested access to a service you provide. Approve to grant access, or reject to remove the request."}
        </p>
      </div>
      <div className="px-5 py-4 space-y-4 text-sm max-h-[60vh] overflow-auto">
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm break-all">
          <span className="text-bc-blue font-semibold">
            {conn.clientId}
          </span>
          <span className="text-ink-placeholder">→</span>
          <span className="text-bc-blue font-semibold">
            {conn.serviceId}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConnectionStatus connection={conn} />
          {conn.environment && (
            <MetaBadge label={conn.environment} />
          )}
          {conn.policyVersion && (
            <MetaBadge
              label={`policy ${conn.policyVersion}`}
            />
          )}
        </div>
        {hasProposal && proposal && (
          <div className="grid gap-3 md:grid-cols-2 text-xs">
            <div className="rounded border border-border p-3">
              <div className="font-semibold mb-2">Currently approved</div>
              <FieldRow label="Service version" value={conn.requesterDetails?.service?.version} mono />
              <div className="mt-2"><span className="text-ink-secondary">Scopes </span><ScopeChips scopes={conn.requesterDetails?.scopes ?? conn.scopes} /></div>
            </div>
            <div className="rounded border border-support-warning-border bg-support-warning-bg p-3">
              <div className="font-semibold mb-2">Proposed</div>
              <FieldRow label="Service version" value={proposal.requesterDetails?.service?.version} mono />
              <div className="mt-2"><span className="text-ink-secondary">Scopes </span><ScopeChips scopes={proposal.requesterDetails?.scopes} /></div>
            </div>
          </div>
        )}
        {rd && (
          <dl className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1 text-xs">
            <FieldRow
              label="Requester"
              value={rd.requester}
            />
            <FieldRow
              label="Requester email"
              value={rd.requesterEmail}
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
          <span className="text-ink-secondary">
            Scopes requested{" "}
          </span>
          <ScopeChips scopes={scopes} />
        </div>
      </div>
      <div className="px-5 py-3 bg-surface-muted border-t border-border flex justify-end gap-2">
        <Btn variant="secondary" data={{ "dialog-close": "" }}>
          Cancel
        </Btn>
        <div className="flex gap-2">
          <form
            method="post"
            action="/connections/reject"
            className="inline"
          >
            {hidden}
            <Btn type="submit" danger>
              {hasProposal ? "Reject changes" : "Reject"}
            </Btn>
          </form>
          <form
            method="post"
            action="/connections/approve"
            className="inline"
          >
            {hidden}
            <Btn type="submit">{hasProposal ? "Approve changes" : "Approve"}</Btn>
          </form>
        </div>
      </div>
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
    <section className="bg-white border border-border rounded-lg">
      <header className="rounded-t-lg bg-surface-muted border-b border-border px-4 py-3">
        <h3 className="font-semibold text-bc-blue break-all">
          <ClientSubsystemLink clientId={clientId} />
        </h3>
        {subsystem?.name && (
          <p className="text-xs text-ink-secondary">
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
  allSubsystems,
  services,
  config,
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
  const r1RequestUrl = config.connections?.r1RequestUrl;

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
    { label: "Connection Requests" },
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
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <h1 className="text-5xl font-bold mb-2">
            Connection Requests
          </h1>
          <p className="text-ink-invert-secondary">
            Connection requests for an organization member,
            grouped by subsystem — each subsystem appears
            where it is the client or the service provider.
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
            action="/connections"
            submitLabel="Load connections"
            autoSubmit
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {flash && (
          <div
            role="status"
            className={[
              "mb-4 rounded-md border-l-4 px-4 py-3 text-sm text-ink",
              flash.kind === "success"
                ? "border-support-success-border bg-support-success-bg"
                : "border-support-danger-border bg-support-danger-bg",
            ].join(" ")}
          >
            {flash.message}
          </div>
        )}
        {error && !flash && (
          <div
            role="alert"
            className="mb-4 rounded-md border-l-4 border-support-danger-border bg-support-danger-bg text-ink px-4 py-3 text-sm"
          >
            {error}
          </div>
        )}

        {!selectedOrg ? (
          <div className="text-center py-16 bg-surface-muted rounded-lg border border-border">
            <p className="text-ink-secondary">
              Select an organization member above to view
              its connections.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
              <div>
                <h2 className="text-2xl font-bold text-bc-blue">
                  {selectedOrg.title}
                </h2>
                <p className="text-xs text-ink-secondary font-mono">
                  {selectedOrg.member.memberClass}/
                  {selectedOrg.member.memberId}
                </p>
                <p className="text-ink-secondary text-sm mt-1">
                  {connections.length} connection
                  {connections.length === 1 ? "" : "s"}{" "}
                  across {groups.length} client
                  {groups.length === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r1RequestUrl && (
                  <Btn
                    href={r1RequestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="primary"
                    ariaLabel="Request a connection through Common SSO (opens in a new tab)"
                  >
                    Request Connection through Common SSO
                  </Btn>
                )}
              </div>
            </div>

            {connections.length === 0 ? (
              <div className="text-center py-16 bg-surface-muted rounded-lg border border-border">
                <p className="text-ink-secondary">
                  No connections yet for this organization.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <StatusLegend />
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

          </>
        )}
      </div>

      <dialog
        id="connection-agreement"
        aria-labelledby="connection-agreement-title"
        className="sdx-dialog sdx-dialog-wide"
        data-chart-src={CHART_JS_URL}
      >
        <header className="border-b border-border px-5 py-4">
          <h2 id="connection-agreement-title" className="text-lg font-bold text-bc-blue">
            Information Sharing Agreement
          </h2>
          <p data-agreement-subtitle className="mt-1 break-words text-sm text-ink-secondary" hidden />
        </header>
        <div data-agreement-content />
        <footer className="flex justify-end border-t border-border px-5 py-3">
          <Btn variant="secondary" data={{ "dialog-close": "" }}>Close</Btn>
        </footer>
      </dialog>

      <script
        dangerouslySetInnerHTML={{ __html: AGREEMENT_TRAFFIC_SCRIPT + DIALOG_SCRIPT }}
      />
      <script
        dangerouslySetInnerHTML={{ __html: EDIT_SCRIPT }}
      />
    </Layout>
  );
}
