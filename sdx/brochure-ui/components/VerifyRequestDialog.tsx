const verifyRequestScript = await Deno.readTextFile(
  new URL("../public/verify-request.js", import.meta.url),
);

export function VerifyRequestDialog(
  { org, environment }: { org: string; environment: string },
) {
  return (
    <div data-request-verifier>
      <button
        type="button"
        data-open-request-verifier
        className="rounded border border-border-dark bg-btn-secondary text-ink hover:bg-btn-secondary-hover px-3 py-2 text-sm font-semibold"
      >
        Verify Request
      </button>
      <dialog
        data-request-verifier-dialog
        aria-label="Verify Request"
        className="rounded-lg p-0 w-full max-w-2xl backdrop:bg-black/40"
      >
        <div className="p-6 space-y-4">
          <header className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-[#003366]">
              Verify Request
            </h2>
            <button
              type="button"
              data-close-request-verifier
              aria-label="Close verification dialog"
            >
              ✕
            </button>
          </header>
          <p className="text-sm text-gray-600">
            Check the edge token, organization signature and published
            certificate chains using this organization’s {environment}{" "}
            trust key set.
          </p>
          <form
            method="post"
            action="/api/trust/verify-request"
            data-request-verifier-form
            className="space-y-3"
          >
            <input type="hidden" name="org" value={org} />
            <input type="hidden" name="environment" value={environment} />
            <label className="block text-sm">
              X-Client-ID<input
                name="clientId"
                required
                placeholder="MIN.TEC.MY-SUBSYSTEM"
                className="block w-full border rounded p-2 mt-1 font-mono text-sm"
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              X-Edge-Token
              <span className="block text-xs text-gray-500 italic">
                Service Edge Runtime Identity
              </span>
              <textarea
                name="edgeToken"
                required
                rows={4}
                className="block w-full border rounded p-2 mt-1 font-mono text-xs"
                spellCheck={false}
              />
            </label>
            <label className="block text-sm">
              X-Entity-Sig
              <span className="block text-xs text-gray-500 italic">
                Service Owner Signature
              </span>
              <textarea
                name="entitySig"
                required
                rows={3}
                className="block w-full border rounded p-2 mt-1 font-mono text-xs"
                spellCheck={false}
              />
            </label>
            <button className="rounded bg-[#003366] text-white px-4 py-2">
              Check
            </button>
          </form>
          <p
            data-request-verifier-result
            role="status"
            aria-live="polite"
            className="font-semibold"
          />
          <ul data-request-verifier-checks className="space-y-2 text-sm" />
          <footer className="flex justify-end border-t pt-3">
            <button
              type="button"
              data-close-request-verifier
              className="rounded border px-4 py-2"
            >
              Close
            </button>
          </footer>
        </div>
      </dialog>
    </div>
  );
}

export function VerifyRequestScript() {
  return <script dangerouslySetInnerHTML={{ __html: verifyRequestScript }} />;
}
