import { CopyButton } from "./CopyButton.tsx";
import type { JwkRecord } from "../types.ts";

function jwkAlgorithmLabel(k: JwkRecord): string {
  if (k.kty === "EC" && k.crv) return `EC (${k.crv})`;
  if (k.kty === "RSA") return "RSA";
  if (k.kty === "OKP" && k.crv) return `OKP (${k.crv})`;
  return k.kty;
}

export function KeysetKeyCard({ k }: { k: JwkRecord }) {
  const useLabel =
    k.use === "sig" ? "Signing" : k.use === "enc" ? "Encryption" : k.use;
  const chain = k.certs ?? [];
  return (
    <div className="bg-white rounded-lg border border-border overflow-hidden">
      <div className="px-5 py-4 bg-surface-muted border-b border-border border-l-4 border-l-bc-blue">
        <div className="flex flex-wrap items-baseline gap-2 mb-2">
          <span className="text-xs px-2 py-0.5 rounded border bg-white text-ink-secondary border-border font-mono">
            {jwkAlgorithmLabel(k)}
          </span>
          {useLabel && (
            <span className="text-xs px-2 py-0.5 rounded border bg-support-info-bg text-support-info-border border-support-info-border">
              {useLabel}
            </span>
          )}
          {k.alg && (
            <span className="text-xs px-2 py-0.5 rounded border bg-white text-ink-secondary border-border font-mono">
              {k.alg}
            </span>
          )}
          {chain.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded border bg-support-success-bg text-support-success-border border-support-success-border">
              {chain.length} cert{chain.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {k.kid && (
          <div className="flex items-start gap-1.5">
            <code className="font-mono text-sm text-bc-blue break-all">
              {k.kid}
            </code>
            <CopyButton value={k.kid} />
          </div>
        )}
      </div>
      {k.pem && (
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-ink-secondary uppercase tracking-wide">
              Public key (PEM)
            </span>
            <CopyButton value={k.pem} />
          </div>
          <pre className="font-mono text-xs text-ink-secondary bg-surface-muted border border-border rounded px-3 py-2 overflow-x-auto whitespace-pre">
            {k.pem}
          </pre>
        </div>
      )}
    </div>
  );
}
