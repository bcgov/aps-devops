import { Layout } from "../components/Layout.tsx";
import {
  SDX_ALERTS_TEAMS_URL,
  SDX_DOCS_URL,
  SDX_HOWTO_TEAMS_URL,
  SDX_SUPPORT_PORTAL_URL,
} from "../lib/links.ts";
import type { SessionUser } from "../lib/auth.ts";

interface HelpPageProps {
  currentPath: string;
  user?: SessionUser | null;
}

const inlineLink =
  "text-bc-blue font-semibold underline hover:text-bc-blue-hover rounded-sm";

export function HelpPage({ currentPath, user }: HelpPageProps) {
  return (
    <Layout title="Help" currentPath={currentPath} user={user}>
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-bold mb-2">Help</h1>
          <p className="text-ink-invert-secondary">
            Find information about the SDX Catalogue or get help with SDX.
          </p>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 text-ink leading-relaxed">
        <h2 className="text-xl font-bold text-bc-blue mb-4">
          Using the catalogue
        </h2>
        <p className="mb-8">
          The{" "}
          <a href="/about" className={inlineLink}>About the SDX Catalogue</a>{" "}
          page explains what you can find here, including subsystems,
          organizations and trust services.
        </p>

        <h2 className="text-xl font-bold text-bc-blue mb-4">
          SDX documentation
        </h2>
        <p className="mb-8">
          The{" "}
          <a
            href={SDX_DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={inlineLink}
          >
            SDX documentation
          </a>{" "}
          explains how SDX works, how organizations get started and where to
          find technical guides.
        </p>

        <h2 className="text-xl font-bold text-bc-blue mb-4">Get support</h2>
        <div className="space-y-4">
          <p>
            <span className="font-semibold text-ink">Ask a question:</span>{" "}
            B.C. Public Service employees can use the{" "}
            <a
              href={SDX_HOWTO_TEAMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={inlineLink}
            >
              SDX how-to Teams channel
            </a>{" "}
            for onboarding, registration and general usage questions. Log in
            with your IDIR to join.
          </p>
          <p>
            <span className="font-semibold text-ink">Submit a request:</span>{" "}
            Use the{" "}
            <a
              href={SDX_SUPPORT_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={inlineLink}
            >
              Support Portal
            </a>{" "}
            for technical issues, access requests, security concerns or
            questions that need investigation.
          </p>
          <p>
            <span className="font-semibold text-ink">Get updates:</span>{" "}
            B.C. Public Service employees can follow the{" "}
            <a
              href={SDX_ALERTS_TEAMS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={inlineLink}
            >
              SDX alerts Teams channel
            </a>{" "}
            for maintenance and service updates. Log in with your IDIR to join.
          </p>
        </div>
      </div>
    </Layout>
  );
}
