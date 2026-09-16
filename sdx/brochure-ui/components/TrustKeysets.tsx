import { CopyButton } from "./CopyButton.tsx";
import { KeysetKeyCard } from "./KeysetKeyCard.tsx";
import type { JwkRecord } from "../types.ts";

/** A keyset published for one environment (SDX publishes one keyset per env). */
export interface EnvKeyset {
  environment: string;
  source: string;
  keys: JwkRecord[];
}

// Renders the "Trust keysets" section shared by the org and subsystem detail
// pages: a per-environment group, each with its source URL and key cards.
// Renders nothing when there are no keysets.
export function TrustKeysets({
  keysets,
  description,
}: {
  keysets: EnvKeyset[];
  description: string;
}) {
  if (keysets.length === 0) return null;
  const total = keysets.reduce((n, ks) => n + ks.keys.length, 0);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h2 className="text-4xl font-bold text-bc-blue mb-1">
        Trust keysets
        <span className="ml-2 text-base font-normal text-ink-secondary">
          ({total} key{total !== 1 ? "s" : ""})
        </span>
      </h2>
      <p className="text-ink-secondary text-sm mb-6">{description}</p>
      <div className="flex flex-col gap-8">
        {keysets.map((ks) => (
          <div key={ks.environment}>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-blue-tint text-bc-blue uppercase tracking-wide">
                {ks.environment}
              </span>
              <span className="text-sm text-ink-secondary">
                {ks.keys.length} key{ks.keys.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3 text-xs text-ink-secondary break-all">
              <span>Published at</span>
              <a
                href={ks.source}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-link underline underline-offset-2"
              >
                {ks.source}
              </a>
              <CopyButton value={ks.source} />
            </div>
            <div className="flex flex-col gap-4">
              {ks.keys.map((k, i) => (
                <KeysetKeyCard key={`${k.kid ?? "kid"}-${i}`} k={k} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
