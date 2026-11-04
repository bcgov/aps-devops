import { Layout } from "../components/Layout.tsx";
import { CopyButton } from "../components/custom/CopyButton.tsx";
import type { SessionUser } from "../lib/auth.ts";

interface OnboardingInvitePageProps {
  integrationId: string;
  currentPath: string;
  user?: SessionUser | null;
}

const NEXT_STEPS = [
  "APS Operations starts the onboarding blueprint with a kickoff.",
  "The organization and subsystem are created in SDX.",
  "This integration id is linked to that subsystem.",
  "APS Operations marks the held task complete. SDX then submits the original access request for approval.",
];

function displayName(user: SessionUser): string {
  return (
    user.name ||
    user.preferred_username ||
    user.email ||
    "your SDX account"
  );
}

export function OnboardingInvitePage({
  integrationId,
  currentPath,
  user,
}: OnboardingInvitePageProps) {
  const hasIntegrationId = integrationId.length > 0;
  const signInHref = `/auth/login?returnTo=${encodeURIComponent(currentPath)}`;

  return (
    <Layout title="Onboarding" currentPath={currentPath} user={user}>
      <div className="bg-[#003366] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">
            Continue onboarding in SDX
          </h1>
          <p className="text-blue-200">
            Common SSO asked SDX for API access. This application is not
            onboarded to SDX yet, so the access request is held until
            onboarding finishes.
          </p>
        </div>
      </div>
      <div className="h-1 bg-[#FCBA19]" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section aria-labelledby="integration-id-heading">
          <h2
            id="integration-id-heading"
            className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-2"
          >
            Integration id
          </h2>
          {hasIntegrationId ? (
            <p className="flex items-center gap-2 font-mono text-lg text-[#003366] break-all">
              <span>{integrationId}</span>
              <CopyButton value={integrationId} />
            </p>
          ) : (
            <p className="text-gray-800">
              The integration id was not included in the link.
            </p>
          )}
        </section>

        <section
          className="border border-gray-200 rounded-lg p-5 bg-gray-50"
          aria-labelledby="sign-in-heading"
        >
          <h2
            id="sign-in-heading"
            className="text-xl font-bold text-[#003366] mb-2"
          >
            {user ? "You are signed in" : "Sign in to SDX"}
          </h2>
          {user ? (
            <p className="text-gray-700 leading-relaxed">
              You are signed in as {displayName(user)}.{" "}
              {hasIntegrationId
                ? "This integration id and the next steps stay the same."
                : "The next steps stay the same."}
            </p>
          ) : (
            <>
              <p className="text-gray-700 leading-relaxed mb-4">
                Sign in with your SDX account.
                {hasIntegrationId
                  ? " This page keeps the integration id in the link so you can carry it into that flow."
                  : ""}
              </p>
              <a
                href={signInHref}
                className="inline-block bg-[#003366] text-white font-semibold px-6 py-3 rounded hover:bg-[#002654] transition-colors"
              >
                Sign in
              </a>
            </>
          )}
        </section>

        <section aria-labelledby="next-steps-heading">
          <h2
            id="next-steps-heading"
            className="text-xl font-bold text-[#003366] mb-4"
          >
            What happens next
          </h2>
          <ol className="space-y-3">
            {NEXT_STEPS.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#003366] text-white text-sm font-bold">
                  {index + 1}
                </span>
                <span className="text-gray-800 leading-relaxed pt-0.5">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Layout>
  );
}
