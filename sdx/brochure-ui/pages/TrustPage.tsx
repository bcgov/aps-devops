import { Layout } from "../components/Layout.tsx";
import { CopyButton } from "../components/CopyButton.tsx";
import { EnvFilter } from "../components/EnvFilter.tsx";
import { envAttr } from "../lib/environments.ts";
import type { CertInfo, JwkRecord, JwksData, SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface TrustPageProps {
  sources: JwksData[];
  config: SiteConfig;
  currentPath: string;
  user?: SessionUser | null;
}

const VALIDITY_BADGES: Record<
  CertInfo["validityState"],
  { label: string; color: string }
> = {
  valid: {
    label: "Valid",
    color: "bg-green-50 text-green-800 border-green-200",
  },
  expired: {
    label: "Expired",
    color: "bg-red-50 text-red-800 border-red-200",
  },
  not_yet_valid: {
    label: "Not yet valid",
    color: "bg-yellow-50 text-yellow-800 border-yellow-200",
  },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toUTCString();
}

function publicKeyLabel(cert: CertInfo): string | null {
  if (
    cert.publicKeyType === "unknown" &&
    !cert.publicKeyCurve &&
    !cert.publicKeySize
  ) {
    return null;
  }
  const t = cert.publicKeyType.toUpperCase();
  if (cert.publicKeyCurve) return `${t} (${cert.publicKeyCurve})`;
  if (cert.publicKeySize) return `${t} ${cert.publicKeySize}-bit`;
  return t;
}

function jwkAlgorithmLabel(k: JwkRecord): string {
  if (k.kty === "EC" && k.crv) return `EC (${k.crv})`;
  if (k.kty === "RSA") return "RSA";
  if (k.kty === "OKP" && k.crv) return `OKP (${k.crv})`;
  return k.kty;
}

function CertCard({
  cert,
  index,
  total,
}: {
  cert: CertInfo;
  index: number;
  total: number;
}) {
  const badge = VALIDITY_BADGES[cert.validityState];
  const role =
    index === 0
      ? "Leaf"
      : index === total - 1 && cert.isSelfSigned
        ? "Root"
        : "Intermediate";
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          {role}
        </span>
        <span className="text-xs text-gray-400">
          [{index + 1} of {total}]
        </span>
        <span className="font-semibold text-[#003366] text-sm truncate">
          {cert.subjectCN ?? cert.subject}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {cert.isCA && (
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
              CA
            </span>
          )}
          {cert.isSelfSigned && (
            <span className="text-xs bg-gray-100 text-gray-700 border border-gray-200 px-1.5 py-0.5 rounded">
              self-signed
            </span>
          )}
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded border ${badge.color}`}
          >
            {badge.label}
          </span>
        </span>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-sm">
        <div>
          <dt className="text-xs text-gray-500 uppercase tracking-wide">
            Subject
          </dt>
          <dd className="font-mono text-xs text-gray-700 break-all">
            {cert.subject}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 uppercase tracking-wide">
            Issuer
          </dt>
          <dd className="font-mono text-xs text-gray-700 break-all">
            {cert.issuer}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 uppercase tracking-wide">
            Valid from
          </dt>
          <dd className="text-gray-800">{formatDate(cert.notBefore)}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500 uppercase tracking-wide">
            Valid until
          </dt>
          <dd className="text-gray-800">{formatDate(cert.notAfter)}</dd>
        </div>
        {publicKeyLabel(cert) && (
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide">
              Public key
            </dt>
            <dd className="text-gray-800">{publicKeyLabel(cert)}</dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-gray-500 uppercase tracking-wide">
            Serial
          </dt>
          <dd className="font-mono text-xs text-gray-700 break-all">
            {cert.serial}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-gray-500 uppercase tracking-wide">
            SHA-256 fingerprint
          </dt>
          <dd className="flex items-center gap-1.5">
            <code className="font-mono text-xs text-gray-700 break-all">
              {cert.fingerprintSha256}
            </code>
            <CopyButton value={cert.fingerprintSha256} />
          </dd>
        </div>
        {cert.sans.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-gray-500 uppercase tracking-wide">
              Subject alternative names
            </dt>
            <dd className="flex flex-wrap gap-1 mt-1">
              {cert.sans.map((s) => (
                <span
                  key={s}
                  className="text-xs bg-gray-50 text-gray-700 border border-gray-200 px-1.5 py-0.5 rounded font-mono"
                >
                  {s}
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function KeyCard({ k, index }: { k: JwkRecord; index: number }) {
  const chain = k.certs ?? [];
  const chainStatus =
    chain.length === 0
      ? null
      : chain.every((c) => c.validityState === "valid")
        ? {
            label: "Chain currently valid",
            color: "bg-green-50 text-green-800 border-green-200",
          }
        : chain.some((c) => c.validityState === "expired")
          ? {
              label: "Chain has expired certs",
              color: "bg-red-50 text-red-800 border-red-200",
            }
          : {
              label: "Chain not yet valid",
              color: "bg-yellow-50 text-yellow-800 border-yellow-200",
            };

  const useLabel =
    k.use === "sig" ? "Signing" : k.use === "enc" ? "Encryption" : k.use;

  return (
    <div className="bg-white rounded-lg border border-gray-300 shadow-sm overflow-hidden">
      <div className="px-5 py-4 bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-[#003366]/30 border-l-4 border-l-[#003366]">
        <div className="flex flex-wrap items-baseline gap-2 mb-2">
          <span className="text-sm font-extrabold text-[#003366] uppercase tracking-wider">
            Key #{index + 1}
          </span>
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
          {chainStatus && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ml-auto ${chainStatus.color}`}
            >
              {chainStatus.label}
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

      <div className="px-5 py-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-3">
          <div>
            <dt className="text-xs text-gray-500 uppercase tracking-wide">
              Key type
            </dt>
            <dd className="font-mono text-gray-800">{k.kty}</dd>
          </div>
          {k.crv && (
            <div>
              <dt className="text-xs text-gray-500 uppercase tracking-wide">
                Curve
              </dt>
              <dd className="font-mono text-gray-800">{k.crv}</dd>
            </div>
          )}
        </dl>

        {k.pem && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <dt className="text-xs text-gray-500 uppercase tracking-wide">
                Public key (PEM)
              </dt>
              <CopyButton value={k.pem} />
            </div>
            <pre className="font-mono text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-2 overflow-x-auto whitespace-pre">
              {k.pem}
            </pre>
          </div>
        )}

        {k.pemError && !k.pem && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
            Could not derive PEM for this key: {k.pemError}
          </div>
        )}

        {k.certError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">
            Could not parse one or more certificates: {k.certError}
          </div>
        )}

        {chain.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-[#003366] mb-2">
              Certificate chain
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({chain.length} cert{chain.length !== 1 ? "s" : ""})
              </span>
            </h4>
            <div className="flex flex-col gap-3">
              {chain.map((cert, i) => (
                <CertCard
                  key={`${cert.fingerprintSha256}-${i}`}
                  cert={cert}
                  index={i}
                  total={chain.length}
                />
              ))}
            </div>
          </div>
        )}

        {chain.length === 0 && !k.x5c && (
          <div className="text-sm text-gray-500 italic">
            No certificate chain (x5c) provided for this key.
          </div>
        )}
      </div>
    </div>
  );
}

function SourceSection({ source }: { source: JwksData }) {
  const totalCerts = source.keys.reduce(
    (n, k) => n + (k.certs?.length ?? 0),
    0,
  );
  const hasError = !!source.error;

  return (
    <details
      open
      data-env-item
      data-env={source.environment ?? envAttr(source.url)}
      className="group mb-6 border-2 border-[#003366] rounded-lg overflow-hidden bg-white shadow-sm"
    >
      <summary className="cursor-pointer list-none bg-[#003366] text-white hover:bg-[#002a52] transition-colors">
        <div className="px-5 py-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#FCBA19] shrink-0">
            JWKS source
          </span>
          <code className="font-mono text-sm break-all flex-1 min-w-0">
            {source.url}
          </code>
          <span className="text-xs text-blue-200 shrink-0 tabular-nums">
            {hasError
              ? "load failed"
              : `${source.keys.length} key${source.keys.length !== 1 ? "s" : ""} · ${totalCerts} cert${totalCerts !== 1 ? "s" : ""}`}
          </span>
          <span
            aria-hidden="true"
            className="text-blue-200 text-lg group-open:rotate-90 transition-transform shrink-0"
          >
            ›
          </span>
        </div>
        <div className="h-1 bg-[#FCBA19]" />
      </summary>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-4">
          <span>Fetched {formatDate(source.fetchedAt)}</span>
          <span className="flex items-center gap-1.5">
            <a
              href={source.url}
              className="font-mono text-[#003366] underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              open ↗
            </a>
            <CopyButton value={source.url} />
          </span>
        </div>

        {source.error ? (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            Failed to load: {source.error}
          </div>
        ) : source.keys.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500 font-medium">
              No keys present in this registry.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {source.keys.map((k, i) => (
              <KeyCard key={k.kid ?? `key-${i}`} k={k} index={i} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export function TrustPage({
  sources,
  config: _config,
  currentPath,
  user,
}: TrustPageProps) {
  const totalKeys = sources.reduce((n, s) => n + s.keys.length, 0);
  const totalCerts = sources.reduce(
    (n, s) => n + s.keys.reduce((m, k) => m + (k.certs?.length ?? 0), 0),
    0,
  );

  return (
    <Layout title="Trust" currentPath={currentPath} user={user}>
      {/* Header */}
      <div className="bg-[#003366] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-bold mb-3">Trust registry</h1>
          <p className="text-blue-200 max-w-2xl">
            Public keys and signing certificates published by members of the
            Secure Data Exchange. Use these to verify signatures on tokens and
            messages used on SDX.
          </p>
          <p className="text-blue-300 text-sm mt-3">
            {sources.length} source{sources.length !== 1 ? "s" : ""} ·{" "}
            {totalKeys} key{totalKeys !== 1 ? "s" : ""} · {totalCerts}{" "}
            certificate{totalCerts !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      {user && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <EnvFilter label="Environment" />
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {sources.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500 font-medium">
              No JWKS sources configured.
            </p>
          </div>
        ) : (
          sources.map((source) => (
            <SourceSection key={source.url} source={source} />
          ))
        )}
      </div>
    </Layout>
  );
}
