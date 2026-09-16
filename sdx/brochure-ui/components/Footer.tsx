export function Footer() {
  return (
    <footer className="bg-bc-blue-dark text-ink-invert mt-16">
      <div className="h-[3px] bg-bc-gold" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-ink-invert-secondary">
            <p className="font-semibold text-ink-invert mb-1">
              BC Government Secure Data Exchange
            </p>
            <p>
              API Programme Services · Connected Services BC
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-invert-secondary"
            aria-label="Footer links"
          >
            <a
              href="https://www.gov.bc.ca/gov/content/home/disclaimer"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink-invert transition-colors rounded-sm"
            >
              Disclaimer
            </a>
            <a
              href="https://www.gov.bc.ca/gov/content/home/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink-invert transition-colors rounded-sm"
            >
              Privacy
            </a>
            <a
              href="https://www.gov.bc.ca/gov/content/home/accessibility"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink-invert transition-colors rounded-sm"
            >
              Accessibility
            </a>
            <a
              href="https://developer.gov.bc.ca/docs/default/component/aps-infra-platform-docs/concepts/secure-data-exchange/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink-invert transition-colors rounded-sm"
            >
              Instructions & Support
            </a>
          </nav>
        </div>
        <div className="mt-6 pt-6 border-t border-white/20 text-xs text-ink-invert-secondary">
          Copyright &copy; {new Date().getFullYear()}{" "}
          Government of the Province of British Columbia.
          All rights reserved.
        </div>
      </div>
    </footer>
  );
}
