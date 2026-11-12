import { Layout } from "../components/Layout.tsx";
import { Btn } from "../components/Btn.tsx";
import {
  Breadcrumb,
  type Crumb,
} from "../components/custom/Breadcrumb.tsx";
import { OrgPicker } from "../components/custom/OrgPicker.tsx";
import type {
  ConnectionGatewayPattern,
  ConnectionProvisionerStatus,
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

function StatusPill({
  connection,
}: {
  connection: ConnectionRequest;
}) {
  if (connection.isApproved && connection.isActive) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-support-success-bg text-support-success-border">
        <span className="w-1.5 h-1.5 rounded-full bg-support-success-border" />
        Active
      </span>
    );
  }
  if (connection.isApproved) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-support-info-bg text-support-info-border">
        <span className="w-1.5 h-1.5 rounded-full bg-support-info-border" />
        Approved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-support-warning-bg text-ink">
      <span className="w-1.5 h-1.5 rounded-full bg-support-warning-border" />
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
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-support-success-bg text-support-success-border">
        <span className="w-1.5 h-1.5 rounded-full bg-support-success-border" />
        Provisioned
      </span>
    );
  }
  if (status.status === "deprovisioning") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-600" />
        Removing access configuration
      </span>
    );
  }
  if (status.status === "deprovisioned") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
        Access configuration removed
      </span>
    );
  }
  if (status.status === "failed") {
    const label = status.operation === "deprovision"
      ? "Couldn't remove access configuration"
      : "Provisioning failed";
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-support-danger-bg text-support-danger-border">
        <span className="w-1.5 h-1.5 rounded-full bg-support-danger-border" />
        {label}
      </span>
    );
  }
  if (status.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-surface-muted text-ink-secondary">
        <span className="w-1.5 h-1.5 rounded-full bg-border-medium" />
        Provisioning
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-surface-muted text-ink-secondary">
      <span className="w-1.5 h-1.5 rounded-full bg-border-medium" />
      {status.status}
    </span>
  );
}

function revokeGuidance(connection: ConnectionRequest): string | null {
  if (connection.isActive) {
    return "Deactivate this connection before revoking access.";
  }

  const status = connection.provisionerStatus;
  if (status?.status === "deprovisioned") return null;
  if (status?.status === "deprovisioning") {
    return "Wait for access configuration removal to finish before revoking access.";
  }
  if (
    status?.status === "failed" &&
    status.operation === "deprovision"
  ) {
    return "Access configuration removal failed. Open Customize and save the inactive connection to retry.";
  }

  return "Open Customize and save this connection as inactive to remove its access configuration before revoking access.";
}

function GuidanceTip({ id, message }: { id: string; message: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Why revoke access is unavailable"
        aria-describedby={id}
        className="cursor-help inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-gray-500 hover:border-[#003366] hover:text-[#003366] focus:outline-none focus:ring-2 focus:ring-[#FCBA19]"
      >
        <span aria-hidden="true">?</span>
      </button>
      <span
        className="invisible absolute right-0 top-full z-20 w-72 pt-2 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        <span
          id={id}
          role="tooltip"
          className="block rounded border border-gray-200 bg-white p-3 text-left text-xs font-normal text-gray-700 shadow-lg"
        >
          {message}
        </span>
      </span>
    </span>
  );
}

const DIALOG_STYLE = `
dialog.sdx-dialog { border: none; border-radius: var(--layout-border-radius-large); padding: 0; max-width: 560px; width: 92%; box-shadow: var(--surface-shadow-large); }
dialog.sdx-dialog.sdx-dialog-wide { max-width: 760px; }
dialog.sdx-dialog::backdrop { background: var(--surface-color-overlay-default); }
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
      isActive: activeEl ? !!activeEl.checked : undefined,
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
      <dt className="text-ink-secondary">{label}</dt>
      <dd
        className={
          mono
            ? "font-mono text-ink break-all"
            : "text-ink break-all"
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
      <span className="text-ink-placeholder italic">none</span>
    );
  }
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {scopes.map((s) => (
        <span
          key={s}
          className="text-xs bg-surface-blue-tint text-bc-blue border border-border px-1.5 py-0.5 rounded font-mono"
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
              className="text-xs bg-surface-blue-tint text-bc-blue border border-border px-1.5 py-0.5 rounded font-mono"
            >
              {f}
            </span>
          ))}
        </div>
      )}
      {token && (
        <div className="border border-border rounded p-2 bg-surface-muted">
          <div className="text-xs font-semibold text-ink-secondary mb-1">
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
        <div className="border border-border rounded p-2 bg-surface-muted">
          <div className="text-xs font-semibold text-ink-secondary mb-1">
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
            <span className="text-ink-secondary">scopes </span>
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

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
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
          name="isApproved"
          value={conn.isApproved ? "true" : "false"}
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
          <label className="flex items-center gap-3 border border-border rounded-lg px-3 py-2">
            <input
              type="checkbox"
              data-active-toggle
              defaultChecked={Boolean(conn.isActive)}
              className="rounded border-border"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">
                Active
              </span>
              <span className="block text-xs text-ink-secondary">
                Whether this connection is enabled.
              </span>
            </span>
          </label>

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
          <button
            type="button"
            data-dialog-close
            className="text-sm font-semibold px-3 py-2 rounded bg-btn-secondary border border-border-dark text-ink hover:bg-btn-secondary-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="text-sm font-semibold px-4 py-2 rounded bg-bc-blue text-white hover:bg-bc-blue-hover"
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
  const hasId = Boolean(conn.id);
  const guidance = conn.isApproved ? revokeGuidance(conn) : null;
  const canDelete = conn.isApproved ? hasId && guidance === null : hasId;
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
    <article className="bg-white border border-border rounded-lg">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="font-mono text-sm text-ink break-all">
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
              <span className="text-xs text-ink-secondary">
                Requested by{" "}
                <span className="text-ink-secondary font-medium">
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
            className="text-xs font-semibold px-3 py-1 rounded bg-btn-secondary border border-border-dark text-ink hover:bg-btn-secondary-hover"
          >
            Customize...
          </button>
          {isProviderPending ? (
            <button
              type="button"
              data-dialog-open={reviewId}
              className="text-xs font-semibold px-3 py-1 rounded bg-btn-primary text-white hover:bg-btn-primary-hover"
            >
              Approve / Reject
            </button>
          ) : (
            canDelete ? (
              <button
                type="button"
                data-dialog-open={confirmId}
                className="text-xs font-semibold px-3 py-1 rounded border border-danger text-danger hover:bg-support-danger-bg"
              >
                {destructiveAction.label}
              </button>
            ) : conn.isApproved && hasId ? (
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  disabled
                  className="text-xs font-semibold px-3 py-1 rounded border border-gray-300 text-gray-400 cursor-not-allowed"
                >
                  Revoke access
                </button>
                {guidance && (
                  <GuidanceTip
                    id={`${confirmId}-guidance`}
                    message={guidance}
                  />
                )}
              </div>
            ) : null
          )}
        </div>
      </div>

      {hasDetails && (
        <details className="border-t border-border">
          <summary className="cursor-pointer list-none px-4 py-2 text-xs font-medium text-bc-blue hover:bg-surface-muted select-none">
            ▸ Connection details
          </summary>
          <div className="px-4 py-3 bg-surface-muted space-y-4 text-xs">
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
                      <dt className="text-ink-secondary">
                        Endpoint
                      </dt>
                      <dd className="font-mono text-ink break-all">
                        <a
                          href={provisionerStatus.endpoint}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-bc-blue underline hover:no-underline"
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
        <p className="text-xs text-ink-placeholder">
          This action cannot be undone.
        </p>
      </div>
      <div className="px-5 py-3 bg-surface-muted border-t border-border flex justify-end gap-2">
        <button
          type="button"
          data-dialog-close
          className="text-sm font-semibold px-3 py-2 rounded bg-btn-secondary border border-border-dark text-ink hover:bg-btn-secondary-hover"
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
          <Btn type="submit" danger>{action.label}</Btn>
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
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-lg font-bold text-bc-blue">
          Review connection request
        </h2>
        <p className="text-xs text-ink-secondary mt-1">
          A consumer has requested access to a service you
          provide. Approve to grant access, or reject to
          remove the request.
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
        <button
          type="button"
          data-dialog-close
          className="text-sm font-semibold px-3 py-2 rounded bg-btn-secondary border border-border-dark text-ink hover:bg-btn-secondary-hover"
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
              className="text-sm font-semibold px-4 py-2 rounded border border-danger text-danger hover:bg-support-danger-bg"
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
            <Btn type="submit">Approve</Btn>
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
    <section className="bg-white border border-border rounded-lg overflow-hidden">
      <header className="bg-surface-muted border-b border-border px-4 py-3">
        <h3 className="font-semibold text-bc-blue break-all">
          <a
            href={`/subsystems/${encodeURIComponent(clientId)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {clientId}
          </a>
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

          </>
        )}
      </div>

      <script
        dangerouslySetInnerHTML={{ __html: DIALOG_SCRIPT }}
      />
      <script
        dangerouslySetInnerHTML={{ __html: EDIT_SCRIPT }}
      />
    </Layout>
  );
}
