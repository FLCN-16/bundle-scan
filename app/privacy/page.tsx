import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Bundle Scan",
  description: "Privacy policy for Bundle Scan.",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-16 text-sm text-slate-700 dark:text-slate-300 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Privacy Policy</h1>
        <p className="text-slate-500 dark:text-slate-400">Last updated: May 2025</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">What we collect</h2>
        <p>
          Bundle Scan does not require an account and does not store personally identifiable information. When you look up a
          package, the package name and version you query may be logged transiently for debugging and rate-limiting
          purposes but is never sold or shared with third parties.
        </p>
        <p>
          Standard server access logs (IP address, timestamp, HTTP method, path, user-agent) may be retained for up to
          30 days to diagnose errors and protect against abuse.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Cookies &amp; analytics</h2>
        <p>
          Bundle Scan does not use tracking cookies or third-party analytics scripts. No advertising networks are
          present on this site.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Third-party data sources</h2>
        <p>
          Vulnerability and package data is fetched in real time from the following public services. Your query may be
          forwarded to these services as part of normal operation:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <a href="https://osv.dev" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">OSV.dev</a>
            {" "}— open-source vulnerability database by Google
          </li>
          <li>
            <a href="https://github.com/advisories" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">GitHub Advisory Database</a>
            {" "}— community-curated security advisories
          </li>
          <li>
            <a href="https://nvd.nist.gov" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">NVD (NIST)</a>
            {" "}— National Vulnerability Database
          </li>
          <li>
            <a href="https://www.npmjs.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">npm Registry</a>
            {" "}— package metadata and tarball sizes
          </li>
          <li>
            <a href="https://pypi.org" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">PyPI</a>
            {" "}— Python package index metadata
          </li>
          <li>
            <a href="https://central.sonatype.com" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Maven Central</a>
            {" "}— Java/JVM package metadata
          </li>
        </ul>
        <p>
          Each of these services has its own privacy policy. We encourage you to review them if you have concerns about
          how your queries may be processed by those services.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Contact</h2>
        <p>
          Questions about this policy? Reach out at{" "}
          <a href="https://thefalcon.dev" target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">thefalcon.dev</a>.
        </p>
      </section>
    </main>
  );
}
