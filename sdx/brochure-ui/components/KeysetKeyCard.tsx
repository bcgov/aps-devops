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
    <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-[#003366]/30 border-l-4 border-l-[#003366]">
        <div className="flex flex-wrap items-baseline gap-2 mb-2">
          <span className="text-xs px-2 py-0.5 rounded border bg-white text-gray-700 border-gray-300 font-mono">
            {jwkAlgorithmLabel(k)}
          </span>
          {useLabel && (
            <span className="text-xs px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200">
              {useLabel}
            </span>
          )}
          {k.alg && (
            <span className="text-xs px-2 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200 font-mono">
              {k.alg}
            </span>
          )}
          {chain.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded border bg-green-50 text-green-800 border-green-200">
              {chain.length} cert{chain.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {k.kid && (
          <div className="flex items-start gap-1.5">
            <code className="font-mono text-sm text-[#003366] break-all">
              {k.kid}
            </code>
            <CopyButton value={k.kid} />
          </div>
        )}
      </div>
      {k.pem && (
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              Public key (PEM)
            </span>
            <CopyButton value={k.pem} />
          </div>
          <pre className="font-mono text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2 overflow-x-auto whitespace-pre">
            {k.pem}
          </pre>
        </div>
      )}
    </div>
  );
}
