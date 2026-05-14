import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — Bundle Scan",
  description: "Terms of use for Bundle Scan.",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-16 text-sm text-slate-700 dark:text-slate-300 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Terms of Use</h1>
        <p className="text-slate-500 dark:text-slate-400">Last updated: May 2025</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Acceptance</h2>
        <p>
          By using Bundle Scan you agree to these terms. If you do not agree, please stop using the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Service description</h2>
        <p>
          Bundle Scan is a free tool that analyzes open-source packages for bundle size, dependency trees, and known
          security vulnerabilities. Results are provided for informational purposes only and should not be treated as
          a definitive security audit.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Data sources</h2>
        <p>
          Vulnerability and package information is sourced from publicly available databases. Bundle Scan does not
          independently verify this data and makes no warranties as to its accuracy, completeness, or timeliness.
          The data sources used are:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <a href="https://osv.dev" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">OSV.dev</a>
            {" "}(Open Source Vulnerability database, Google)
          </li>
          <li>
            <a href="https://github.com/advisories" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">GitHub Advisory Database</a>
          </li>
          <li>
            <a href="https://nvd.nist.gov" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">NVD — National Vulnerability Database (NIST)</a>
          </li>
          <li>
            <a href="https://www.npmjs.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">npm Registry</a>
          </li>
          <li>
            <a href="https://pypi.org" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">PyPI</a>
          </li>
          <li>
            <a href="https://central.sonatype.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Maven Central</a>
          </li>
        </ul>
        <p>
          Each data source is governed by its own terms of service and licensing. Vulnerability data from NVD is
          provided by NIST and is in the public domain. GitHub Advisory Database data is licensed under{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">CC BY 4.0</a>.
          OSV data is provided under the{" "}
          <a href="https://opensource.org/licenses/Apache-2.0" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Apache 2.0 License</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Acceptable use</h2>
        <p>You may not:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Scrape or bulk-download data from Bundle Scan at a rate that degrades service for other users</li>
          <li>Use the service in any way that violates applicable law</li>
          <li>Attempt to reverse-engineer or interfere with the service</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Disclaimer of warranties</h2>
        <p>
          Bundle Scan is provided <strong>"as is"</strong> without warranty of any kind. We do not guarantee that the
          service will be available, accurate, or error-free. Security information displayed is pulled from
          third-party databases and may be incomplete or out of date.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, Bundle Scan and its operators shall not be liable for any direct,
          indirect, incidental, or consequential damages arising from your use of or reliance on this service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Changes</h2>
        <p>
          These terms may be updated at any time. Continued use of the service after changes are posted constitutes
          acceptance of the new terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Contact</h2>
        <p>
          Questions?{" "}
          <a href="https://thefalcon.dev" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">thefalcon.dev</a>
        </p>
      </section>
    </main>
  );
}
