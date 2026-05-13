"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { fetchSecurity } from "@/lib/actions/security";
import type { Advisory, SecurityResult, Severity } from "@/lib/types";

const SEV: Record<Severity, { bar: string; bg: string; text: string; dot: string }> = {
  critical: { bar: "bg-red-500",    bg: "bg-red-500/8 dark:bg-red-500/10",    text: "text-red-600 dark:text-red-400",    dot: "bg-red-500" },
  high:     { bar: "bg-orange-500", bg: "bg-orange-500/8 dark:bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", dot: "bg-orange-500" },
  medium:   { bar: "bg-amber-500",  bg: "bg-amber-500/8 dark:bg-amber-500/10",  text: "text-amber-600 dark:text-amber-400",  dot: "bg-amber-500" },
  low:      { bar: "bg-blue-500",   bg: "bg-blue-500/8 dark:bg-blue-500/10",   text: "text-blue-600 dark:text-blue-400",   dot: "bg-blue-500" },
  unknown:  { bar: "bg-slate-400",  bg: "bg-slate-500/8 dark:bg-slate-500/10",  text: "text-slate-500 dark:text-slate-400",  dot: "bg-slate-400" },
};

function SeverityPill({ severity, count }: { severity: Severity; count: number }) {
  const s = SEV[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label font-semibold tracking-tight ${s.bg} ${s.text} border border-current/10`}>
      <span className={`size-1.5 rounded-full flex-shrink-0 ${s.dot}`} aria-hidden />
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
      <span className="font-bold opacity-70">{count}</span>
    </span>
  );
}

function SourceTag({ source }: { source: "OSV" | "GHSA" | "NVD" }) {
  const cls = {
    OSV:  "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/15",
    GHSA: "text-violet-700 bg-violet-500/10 dark:text-violet-400 border border-violet-500/15",
    NVD:  "text-slate-600 bg-slate-500/10 dark:text-slate-400 border border-slate-500/15",
  }[source];
  return (
    <span className={`text-xxs font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${cls}`}>
      {source}
    </span>
  );
}

function AdvisoryRow({ adv, pkg, version }: { adv: Advisory; pkg: string; version: string }) {
  const s = SEV[adv.severity];
  const params = new URLSearchParams({ pkg, version, source: adv.source });
  return (
    <a
      href={`/vuln/${encodeURIComponent(adv.id)}?${params}`}
      className={`block rounded-xl border border-current/10 ${s.bg} p-4 hover:brightness-95 dark:hover:brightness-110 transition-[filter] cursor-pointer`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 text-xxs font-bold uppercase tracking-wider ${s.text}`}>
          <span className={`size-1.5 rounded-full ${s.dot}`} />
          {adv.severity}
        </span>
        <SourceTag source={adv.source} />
        <span className={`font-mono text-label font-medium ${s.text}`}>{adv.id}</span>
        {adv.confidence === "low" && (
          <span className="text-xxs text-slate-400 italic">best-effort</span>
        )}
      </div>
      <p className="text-body-sm text-slate-700 dark:text-slate-300 leading-snug">{adv.summary}</p>
      {adv.fixedVersions.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Fixed in{" "}
          {adv.fixedVersions.map((v) => (
            <code key={v} className="px-1.5 py-0.5 rounded-md bg-white/80 dark:bg-white/8 border border-black/6 dark:border-white/8 font-mono text-emerald-700 dark:text-emerald-400 ml-1 text-label">
              {v}
            </code>
          ))}
        </p>
      )}
    </a>
  );
}

function SecuritySkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex gap-2">
        {[90, 72, 80].map((w) => (
          <div key={w} className="h-7 rounded-full bg-slate-200/80 dark:bg-white/6" style={{ width: w }} />
        ))}
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-xl bg-slate-100/80 dark:bg-white/4 p-4 space-y-2">
          <div className="flex gap-2">
            <div className="h-4 w-14 rounded bg-slate-200/80 dark:bg-white/6" />
            <div className="h-4 w-10 rounded bg-slate-200/80 dark:bg-white/6" />
            <div className="h-4 w-28 rounded bg-slate-200/80 dark:bg-white/6" />
          </div>
          <div className="h-3 w-full rounded bg-slate-200/80 dark:bg-white/6" />
          <div className="h-3 w-4/5 rounded bg-slate-200/80 dark:bg-white/6" />
        </div>
      ))}
    </div>
  );
}

export function SecurityClient({ name, ecosystem, version }: { name: string; ecosystem: string; version: string }) {
  const [result, setResult] = useState<SecurityResult | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchSecurity(name, ecosystem, version)
      .then((r) => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [name, ecosystem, version]);

  if (error) {
    return <p className="text-body-sm text-slate-400 py-4 text-center">Security scan unavailable. Try again later.</p>;
  }
  if (!result) return <SecuritySkeleton />;

  const { advisories, sources } = result;
  const counts = {
    critical: advisories.filter((a) => a.severity === "critical").length,
    high:     advisories.filter((a) => a.severity === "high").length,
    medium:   advisories.filter((a) => a.severity === "medium").length,
    low:      advisories.filter((a) => a.severity === "low").length,
  };
  const total = advisories.length;

  return (
    <div className="space-y-4">
      {total === 0 ? (
        <div className="flex items-center gap-2.5 py-1 text-body-sm text-emerald-700 dark:text-emerald-400">
          <span className="size-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Check className="size-3.5 stroke-[2.5]" />
          </span>
          No known vulnerabilities for this version
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {(["critical", "high", "medium", "low"] as const).map((sev) =>
            counts[sev] > 0 ? <SeverityPill key={sev} severity={sev} count={counts[sev]} /> : null
          )}
        </div>
      )}

      <div className="space-y-2.5">
        {advisories.map((adv) => (
          <AdvisoryRow key={`${adv.source}-${adv.id}`} adv={adv} pkg={name} version={version} />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-label text-slate-400 dark:text-slate-500">
        <span className="font-medium">Scanned via</span>
        {sources.osv && <span>OSV.dev</span>}
        {sources.ghsa && <span>GitHub Advisory DB</span>}
        {!sources.ghsa && <span className="opacity-40">GHSA (no token)</span>}
        {sources.nvd && <span>NVD</span>}
      </div>
    </div>
  );
}
