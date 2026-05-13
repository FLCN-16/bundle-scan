import { FileScan } from "@/app/components/FileScan";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan file — Bundle Scan",
  description: "Upload a package.json, requirements.txt, or pom.xml to scan all dependencies for vulnerabilities.",
};

export default function ScanPage() {
  return (
    <main className="flex-1 bg-slate-50 dark:bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-2">
            Scan dependency file
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">
            Upload a <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">package.json</code>,{" "}
            <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">requirements.txt</code>, or{" "}
            <code className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">pom.xml</code>{" "}
            to check all your dependencies for known vulnerabilities.
          </p>
        </div>
        <FileScan />
      </div>
    </main>
  );
}
