// Client-only rendering of the real B.C. Design System Footer. The library's
// defaults already provide the correct gov.bc.ca territorial acknowledgment
// and B.C. logo, so only the contact/links content is app-specific. See
// client/AppChrome.tsx for the bundling constraints (no lib/ or pages/
// imports here).
import { Footer, FooterLinks } from "@bcgov/design-system-react-components";

const LINKS = [
  <a href="https://www.gov.bc.ca/gov/content/home" target="_blank" rel="noopener noreferrer">
    Home
  </a>,
  <a
    href="https://www.gov.bc.ca/gov/content/about-gov-bc-ca"
    target="_blank"
    rel="noopener noreferrer"
  >
    About gov.bc.ca
  </a>,
  <a
    href="https://www.gov.bc.ca/gov/content/home/disclaimer"
    target="_blank"
    rel="noopener noreferrer"
  >
    Disclaimer
  </a>,
  <a href="https://www.gov.bc.ca/gov/content/home/privacy" target="_blank" rel="noopener noreferrer">
    Privacy
  </a>,
  <a
    href="https://www.gov.bc.ca/gov/content/home/accessible-government"
    target="_blank"
    rel="noopener noreferrer"
  >
    Accessibility
  </a>,
  <a
    href="https://developer.gov.bc.ca/docs/default/component/aps-infra-platform-docs/concepts/secure-data-exchange/"
    target="_blank"
    rel="noopener noreferrer"
  >
    Instructions &amp; Support
  </a>,
];

export function AppFooter() {
  return (
    <Footer
      contact={
        <div>
          <p style={{ fontWeight: 700, margin: 0 }}>
            BC Government Secure Data Exchange
          </p>
          <p style={{ margin: 0 }}>API Programme Services · Connected Services BC</p>
        </div>
      }
      links={<FooterLinks title="More info" links={LINKS} />}
    />
  );
}
