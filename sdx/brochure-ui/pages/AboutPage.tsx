import { Layout } from "../components/Layout.tsx";
import { SDX_DOCS_URL } from "../lib/links.ts";
import type { SessionUser } from "../lib/auth.ts";

interface AboutPageProps {
  currentPath: string;
  user?: SessionUser | null;
}

const inlineLink =
  "text-bc-blue font-semibold underline hover:text-bc-blue-hover rounded-sm";

export function AboutPage({ currentPath, user }: AboutPageProps) {
  return (
    <Layout title="About" currentPath={currentPath} user={user}>
      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-bold">About the SDX Catalogue</h1>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 text-ink leading-relaxed">
        <p className="mb-8">
          The SDX Catalogue helps you find services and organizations
          participating in Secure Data Exchange (SDX). You can browse the
          catalogue without logging in.
        </p>

        <h2 className="text-xl font-bold text-bc-blue mb-4">
          What you'll find
        </h2>
        <ul className="list-disc pl-6 space-y-4 mb-8">
          <li>
            <a href="/subsystems" className={inlineLink}>Subsystems</a>
            : systems within participating organizations that provide or use
            services through SDX. Browse them to see what is registered in the
            catalogue.
          </li>
          <li>
            <a href="/organizations" className={inlineLink}>Organizations</a>
            : organizations participating in the B.C. Government Secure Data
            Exchange as service providers, service users, or both.
          </li>
          <li>
            <a href="/trust" className={inlineLink}>Trust Services</a>
            : view members' public keys and signing certificates in the trust
            registry. These are used to verify signatures on SDX tokens and
            messages.
          </li>
        </ul>

        <p className="mb-8">
          People with access can log in to{" "}
          <a href="/console" className={inlineLink}>Member Console</a> to view
          information about their organization's SDX systems and services and
          manage connection requests, depending on their permissions.
        </p>

        <h2 className="text-xl font-bold text-bc-blue mb-4">New to SDX?</h2>
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

        <h2 className="text-xl font-bold text-bc-blue mb-4">Need help?</h2>
        <p>
          For help using the catalogue or finding the right support, visit{" "}
          <a href="/help" className={inlineLink}>Help</a>.
        </p>
      </div>
    </Layout>
  );
}
