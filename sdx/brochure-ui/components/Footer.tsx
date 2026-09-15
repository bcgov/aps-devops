export function Footer() {
  return (
    <footer className="bg-[#003366] text-white mt-16">
      <div className="h-[3px] bg-[#FCBA19]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-sm text-blue-200">
            <p className="font-semibold text-white mb-1">
              BC Government Secure Data Exchange
            </p>
            <p>
              API Programme Services · Connected Services BC
            </p>
          </div>
          <nav
            className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-blue-200"
            aria-label="Footer links"
          >
            <a
              href="https://www.gov.bc.ca/gov/content/home/disclaimer"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Disclaimer
            </a>
            <a
              href="https://www.gov.bc.ca/gov/content/home/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Privacy
            </a>
            <a
              href="https://www.gov.bc.ca/gov/content/home/accessibility"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Accessibility
            </a>
            <a
              href="https://developer.gov.bc.ca/docs/default/component/aps-infra-platform-docs/concepts/secure-data-exchange/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Instructions & Support
            </a>
          </nav>
        </div>
        <div className="mt-6 pt-6 border-t border-blue-800 text-xs text-blue-300">
          Copyright &copy; {new Date().getFullYear()}{" "}
          Government of the Province of British Columbia.
          All rights reserved.
        </div>
      </div>
    </footer>
  );
}
