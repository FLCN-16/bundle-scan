import { AlertTriangle, Check } from "lucide-react";
import type { Advisory, SecurityResult, Severity } from "@/lib/types";
import { SeverityBadge } from "./SeverityBadge";

function countBySeverity(advisories: Advisory[], sev: Severity) {
  return advisories.filter((a) => a.severity === sev).length;
}

function SourceBadge({ source }: { source: "OSV" | "GHSA" | "NVD" }) {
  const colors = {
    OSV: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    GHSA: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    NVD: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span className={`text-xxs font-bold px-1.5 py-0.5 rounded ${colors[source]}`}>
      {source}
    </span>
  );
}

function AdvisoryCard({ adv }: { adv: Advisory }) {
  return (
    <article className="border-t border-white/40 dark:border-white/6 pt-3 space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <SeverityBadge severity={adv.severity} />
        <SourceBadge source={adv.source} />
        {adv.confidence === "low" && (
          <span className="text-xxs text-zinc-400 italic">best-effort</span>
        )}
        {adv.url ? (
          <a
            href={adv.url}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {adv.id}
          </a>
        ) : (
          <span className="font-mono text-xs text-zinc-600">{adv.id}</span>
        )}
      </div>
      <p className="text-sm text-zinc-700 dark:text-zinc-300">{adv.summary}</p>
      {adv.fixedVersions.length > 0 && (
        <p className="text-xs text-zinc-500">
          Fixed in: <span className="font-mono">{adv.fixedVersions.join(", ")}</span>
        </p>
      )}
    </article>
  );
}

export function SecurityPanel({ result }: { result: SecurityResult }) {
  const { advisories, sources } = result;
  const allSourcesAvailable = sources.osv && sources.ghsa && sources.nvd;
  const counts: Record<Severity, number> = {
    critical: countBySeverity(advisories, "critical"),
    high: countBySeverity(advisories, "high"),
    medium: countBySeverity(advisories, "medium"),
    low: countBySeverity(advisories, "low"),
    unknown: countBySeverity(advisories, "unknown"),
  };

  return (
    <section className="rounded-2xl border border-white/50 dark:border-white/8 bg-white/70 dark:bg-white/6 backdrop-blur-xl shadow-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
          Security
        </h2>
        {advisories.length === 0 && (
          <span className={`text-xs font-medium flex items-center gap-1 ${allSourcesAvailable ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
            {allSourcesAvailable ? <Check className="size-3 stroke-[2.5]" /> : <AlertTriangle className="size-3" />}
            {allSourcesAvailable ? "No known vulnerabilities" : "Scan incomplete"}
          </span>
        )}
      </div>

      {advisories.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {(["critical", "high", "medium", "low"] as Severity[]).map((sev) =>
              counts[sev] > 0 ? (
                <SeverityBadge key={sev} severity={sev} count={counts[sev]} />
              ) : null
            )}
          </div>
          {!allSourcesAvailable && (
            <p className="text-xs text-amber-600 dark:text-amber-400">Results may be incomplete because one or more advisory sources were unavailable.</p>
          )}
        </>
      )}

      <div className="space-y-3">
        {advisories.map((adv) => (
          <AdvisoryCard key={`${adv.source}-${adv.id}`} adv={adv} />
        ))}
      </div>

      <div className="pt-2 border-t border-white/40 dark:border-white/6 flex flex-wrap gap-2 text-xxs text-zinc-400">
        <span>Sources:</span>
        {sources.osv && (
          <span className="flex items-center gap-0.5">OSV.dev <Check className="size-2.5 stroke-[2.5]" /></span>
        )}
        {!sources.osv && <span className="text-amber-600/70 dark:text-amber-400/70">OSV unavailable</span>}
        {sources.ghsa && (
          <span className="flex items-center gap-0.5">GHSA <Check className="size-2.5 stroke-[2.5]" /></span>
        )}
        {!sources.ghsa && <span className="text-amber-600/70 dark:text-amber-400/70">GHSA unavailable</span>}
        {sources.nvd && (
          <span className="flex items-center gap-0.5">NVD <Check className="size-2.5 stroke-[2.5]" /></span>
        )}
        {!sources.nvd && <span className="text-amber-600/70 dark:text-amber-400/70">NVD unavailable</span>}
      </div>
    </section>
  );
}
