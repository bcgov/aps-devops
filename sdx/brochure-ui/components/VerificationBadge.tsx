import type {
  ActivityVerification,
  VerificationResult,
  VerificationStatus,
} from "../lib/verification.ts";

interface VerificationBadgeProps {
  verification: ActivityVerification;
}

const STATUS_STYLES: Record<
  VerificationStatus,
  { ring: string; fg: string; bg: string; label: string }
> = {
  valid: {
    ring: "border-green-300",
    fg: "text-green-700",
    bg: "bg-green-50",
    label: "verified",
  },
  invalid: {
    ring: "border-red-300",
    fg: "text-red-700",
    bg: "bg-red-50",
    label: "invalid",
  },
  error: {
    ring: "border-amber-300",
    fg: "text-amber-700",
    bg: "bg-amber-50",
    label: "unverifiable",
  },
  missing: {
    ring: "border-gray-200",
    fg: "text-gray-500",
    bg: "bg-gray-50",
    label: "absent",
  },
};

function ShieldIcon({ status }: { status: VerificationStatus }) {
  // A shield outline with a checkmark/cross/dash inside, sized to fit the
  // badge. Using inline SVG so it travels with the markup.
  const stroke = "currentColor";
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      className="shrink-0"
      aria-hidden="true"
    >
      <path
        d="M12 2.5l8 3v6c0 4.6-3.2 8.6-8 10-4.8-1.4-8-5.4-8-10v-6l8-3z"
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {status === "valid" && (
        <path
          d="M8.5 12.5l2.5 2.5 4.5-5"
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {status === "invalid" && (
        <path
          d="M9 9l6 6M15 9l-6 6"
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
      {status === "error" && (
        <path
          d="M12 8v4M12 15.25v.01"
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
      {status === "missing" && (
        <path
          d="M9 12h6"
          fill="none"
          stroke={stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function CertChainPill({ pass, depth }: { pass: string; depth?: string }) {
  const ok = pass === "true";
  const cls = ok
    ? "border-green-400 text-green-800 bg-green-100"
    : "border-red-400 text-red-800 bg-red-100";
  const depthLabel = depth ? ` (${depth})` : "";
  return (
    <span
      className={`inline-flex items-center px-1 py-px rounded border text-xs font-semibold leading-none ${cls}`}
    >
      cert chain {ok ? "pass" : "fail"}
      {depthLabel}
    </span>
  );
}

function LeafOrgPill({ attr, value }: { attr: "O" | "CN"; value: string }) {
  return (
    <span
      className="inline-flex items-center px-1 py-px rounded border border-blue-300 text-blue-800 bg-blue-50 text-xs font-semibold leading-none"
      title={`leaf cert ${attr}=${value}`}
    >
      {attr}={value}
    </span>
  );
}

function BadgeRow({
  label,
  result,
}: {
  label: string;
  result: VerificationResult;
}) {
  const s = STATUS_STYLES[result.status];
  const detailEntries = result.details
    ? Object.entries(result.details).filter(([, v]) => Boolean(v))
    : [];
  const tooltip = [result.message, ...detailEntries.map(([k, v]) => `${k}: ${v}`)]
    .filter(Boolean)
    .join("\n");
  const certChainPass = result.details?.cert_chain_pass;
  const certChainDepth = result.details?.cert_chain_depth;
  const certLeafO = result.details?.cert_leaf_o;
  const certLeafCn = result.details?.cert_leaf_cn;
  const leafAttr: "O" | "CN" | undefined = certLeafO
    ? "O"
    : certLeafCn
      ? "CN"
      : undefined;
  const leafValue = certLeafO ?? certLeafCn;
  const showLeaf = label === "X-Entity-Sig" && leafAttr && leafValue &&
    (certChainPass === "true" || certChainPass === "false");
  return (
    <div className="flex flex-col items-start gap-0.5 min-w-0">
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${s.ring} ${s.fg} ${s.bg}`}
        title={tooltip || undefined}
      >
        <ShieldIcon status={result.status} />
        <span className="font-semibold">{label}</span>
        <span className="opacity-80">{s.label}</span>
        {(certChainPass === "true" || certChainPass === "false") && (
          <CertChainPill pass={certChainPass} depth={certChainDepth} />
        )}
      </span>
      {showLeaf && (
        <span className="pl-1">
          <LeafOrgPill attr={leafAttr} value={leafValue} />
        </span>
      )}
    </div>
  );
}

function SideColumn({
  heading,
  edge,
  entity,
}: {
  heading: string;
  edge: VerificationResult;
  entity: VerificationResult;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-gray-500 text-xs uppercase tracking-wide font-semibold">
        {heading}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <BadgeRow label="X-Edge-Token" result={edge} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <BadgeRow label="X-Entity-Sig" result={entity} />
      </div>
    </div>
  );
}

export function VerificationBadge({ verification }: VerificationBadgeProps) {
  return (
    <div className="col-span-2 lg:col-span-4 pt-1">
      <span className="text-gray-400 text-xs">verification</span>
      <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <SideColumn
          heading="request"
          edge={verification.edgeToken.request}
          entity={verification.entitySig.request}
        />
        <SideColumn
          heading="response"
          edge={verification.edgeToken.response}
          entity={verification.entitySig.response}
        />
      </div>
    </div>
  );
}
