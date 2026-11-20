import { Btn } from "./Btn.tsx";
const verifyResponseScript = await Deno.readTextFile(
  new URL("../public/verify-response.js", import.meta.url),
);

export function VerifyResponseDialog(
  { org, environment }: { org: string; environment: string },
) {
  return (
    <div data-response-verifier>
      <Btn size="small" data={{ "open-response-verifier": "" }} variant="secondary">
        Verify Response
      </Btn>
      <dialog
        data-response-verifier-dialog
        aria-label="Verify Response"
        className="rounded-lg p-0 w-full max-w-2xl backdrop:bg-black/40"
      >
        <div className="p-6 space-y-4">
          <header className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-[#003366]">
              Verify Response
            </h2>
            <Btn size="small" data={{ "close-response-verifier": "" }} ariaLabel="Close verification dialog" variant="secondary">
              ✕
            </Btn>
          </header>
          <p className="text-sm text-gray-600">
            Verify the provider’s response edge token, organization signature
            and published certificate chains using this organization’s{" "}
            {environment} trust key set.
          </p>
          <form
            method="post"
            action="/api/trust/verify-response"
            data-response-verifier-form
            className="space-y-3"
          >
            <input type="hidden" name="org" value={org} />
            <input type="hidden" name="environment" value={environment} />
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
            <Btn size="small" type="submit">
              Check
            </Btn>
          </form>
          <p
            data-response-verifier-result
            role="status"
            aria-live="polite"
            className="font-semibold"
          />
          <ul data-response-verifier-checks className="space-y-2 text-sm" />
          <footer className="flex justify-end border-t pt-3">
            <Btn size="small" data={{ "close-response-verifier": "" }} variant="secondary">
              Close
            </Btn>
          </footer>
        </div>
      </dialog>
    </div>
  );
}

export function VerifyResponseScript() {
  return <script dangerouslySetInnerHTML={{ __html: verifyResponseScript }} />;
}
