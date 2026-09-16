// B.C. Design System Footer anatomy:
//   1. A full-width territorial acknowledgment statement on a dark grey
//      background (#292929, matched from gov.bc.ca's own site chrome — the
//      vendored design tokens don't export this footer-specific color).
//   2. A solid gold divider below the territorial acknowledgment (rendered
//      here as matching top/bottom borders on that bar, as on gov.bc.ca).
//   3. A logo (not hyperlinked by default) and text content on the left of
//      the main content area.
//   4. A secondary navigation menu on the right of the main content area.
//   5. A copyright statement line at the bottom.
export function Footer() {
  return (
    <footer className="mt-16">
      <div className="bg-[#292929] border-y-4 border-bc-gold">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <p className="text-sm text-ink-invert-secondary max-w-4xl">
            The B.C. Public Service acknowledges the territories of First
            Nations around B.C. and is grateful to carry out our work on
            these lands. We acknowledge the rights, interests, priorities,
            and concerns of all Indigenous Peoples — First Nations, Métis,
            and Inuit — respecting and acknowledging their distinct
            cultures, histories, rights, laws, and governments.
          </p>
        </div>
      </div>

      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
            <div className="flex items-start gap-3">
              <img
                src="/public/bcid-logo-positive.png"
                alt="Government of British Columbia"
                className="h-8 w-auto shrink-0"
              />
              <div className="text-sm text-ink-secondary">
                <p className="font-semibold text-ink mb-1">
                  BC Government Secure Data Exchange
                </p>
                <p>API Programme Services · Connected Services BC</p>
              </div>
            </div>
            <nav
              className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-secondary"
              aria-label="Footer links"
            >
              <a
                href="https://www.gov.bc.ca/gov/content/home"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-bc-blue hover:underline transition-colors rounded-sm"
              >
                Home
              </a>
              <a
                href="https://www.gov.bc.ca/gov/content/about-gov-bc-ca"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-bc-blue hover:underline transition-colors rounded-sm"
              >
                About gov.bc.ca
              </a>
              <a
                href="https://www.gov.bc.ca/gov/content/home/disclaimer"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-bc-blue hover:underline transition-colors rounded-sm"
              >
                Disclaimer
              </a>
              <a
                href="https://www.gov.bc.ca/gov/content/home/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-bc-blue hover:underline transition-colors rounded-sm"
              >
                Privacy
              </a>
              <a
                href="https://www.gov.bc.ca/gov/content/home/accessible-government"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-bc-blue hover:underline transition-colors rounded-sm"
              >
                Accessibility
              </a>
              <a
                href="https://developer.gov.bc.ca/docs/default/component/aps-infra-platform-docs/concepts/secure-data-exchange/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-bc-blue hover:underline transition-colors rounded-sm"
              >
                Instructions &amp; Support
              </a>
            </nav>
          </div>
          <div className="mt-6 pt-6 border-t border-border text-xs text-ink-secondary">
            Copyright &copy; {new Date().getFullYear()}{" "}
            Government of British Columbia. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
