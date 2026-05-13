import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";

import { ExternalLink, Calendar, Tag } from "lucide-react";
import Markdown from "react-markdown";
import { BackButton } from "@/app/components/BackButton";
import type { Severity } from "@/lib/types";

interface OsvRef {
  type: string;
  url: string;
}
interface OsvSeverity {
  type: string;
  score: string;
}
interface OsvAffectedRange {
  type: string;
  events: Array<{ introduced?: string; fixed?: string; last_affected?: string }>;
}
interface OsvAffected {
  package: { name: string; ecosystem: string };
  ranges?: OsvAffectedRange[];
  versions?: string[];
}
interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  severity?: OsvSeverity[];
  affected?: OsvAffected[];
  references?: OsvRef[];
  published?: string;
  modified?: string;
  database_specific?: Record<string, unknown>;
}

const SEV_STYLES: Record<Severity, {
  bg: string; text: string; border: string; dot: string; badge: string;
  headerAccent: string; headerGlow: string; headerGlowInner: string; headerBorder: string;
  tailColor: string;
}> = {
  critical: {
    bg: "bg-red-500/8 dark:bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/20", dot: "bg-red-500",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    headerAccent: "via-red-500/70 dark:via-red-400/60",
    headerGlow: "bg-red-400/12 dark:bg-red-500/20",
    headerGlowInner: "bg-red-500/15 dark:bg-red-400/25",
    headerBorder: "border-red-900/10 dark:border-red-500/15",
    tailColor: "rgb(239 68 68)",
  },
  high: {
    bg: "bg-orange-500/8 dark:bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20", dot: "bg-orange-500",
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    headerAccent: "via-orange-500/70 dark:via-orange-400/60",
    headerGlow: "bg-orange-400/12 dark:bg-orange-500/20",
    headerGlowInner: "bg-orange-500/15 dark:bg-orange-400/25",
    headerBorder: "border-orange-900/10 dark:border-orange-500/15",
    tailColor: "rgb(249 115 22)",
  },
  medium: {
    bg: "bg-amber-500/8 dark:bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    headerAccent: "via-amber-500/70 dark:via-amber-400/60",
    headerGlow: "bg-amber-400/12 dark:bg-amber-500/20",
    headerGlowInner: "bg-amber-500/15 dark:bg-amber-400/25",
    headerBorder: "border-amber-900/10 dark:border-amber-500/15",
    tailColor: "rgb(245 158 11)",
  },
  low: {
    bg: "bg-blue-500/8 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20", dot: "bg-blue-500",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    headerAccent: "via-blue-500/70 dark:via-blue-400/60",
    headerGlow: "bg-blue-400/12 dark:bg-blue-500/20",
    headerGlowInner: "bg-blue-500/15 dark:bg-blue-400/25",
    headerBorder: "border-blue-900/10 dark:border-blue-500/15",
    tailColor: "rgb(59 130 246)",
  },
  unknown: {
    bg: "bg-slate-500/8 dark:bg-slate-500/10", text: "text-slate-500 dark:text-slate-400", border: "border-slate-500/20", dot: "bg-slate-400",
    badge: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20",
    headerAccent: "via-slate-400/40 dark:via-slate-500/30",
    headerGlow: "bg-slate-400/8 dark:bg-slate-500/12",
    headerGlowInner: "bg-slate-500/8 dark:bg-slate-400/15",
    headerBorder: "border-black/6 dark:border-white/6",
    tailColor: "rgb(148 163 184)",
  },
};

const REF_LABELS: Record<string, string> = {
  ADVISORY:   "Advisory",
  ARTICLE:    "Article",
  FIX:        "Fix",
  GIT:        "Commit",
  PACKAGE:    "Package",
  REPORT:     "Report",
  WEB:        "Web",
  EVIDENCE:   "Evidence",
  INTRODUCED: "Introduced",
  DETECTION:  "Detection",
};

function cvssScore(severities?: OsvSeverity[]): number | null {
  if (!severities?.length) return null;
  for (const s of severities) {
    const m = s.score.match(/\/(\d+(?:\.\d+)?)$/);
    if (m) return parseFloat(m[1]);
    const base = s.score.match(/^(\d+(?:\.\d+)?)/);
    if (base) return parseFloat(base[1]);
  }
  return null;
}

function cvssToSeverity(score: number | null): Severity {
  if (score === null) return "unknown";
  if (score >= 9.0) return "critical";
  if (score >= 7.0) return "high";
  if (score >= 4.0) return "medium";
  if (score > 0)    return "low";
  return "unknown";
}

function dbSeverity(vuln: OsvVuln): Severity {
  const sev = (vuln.database_specific as { severity?: string } | undefined)?.severity;
  if (!sev) return cvssToSeverity(cvssScore(vuln.severity));
  const map: Record<string, Severity> = {
    CRITICAL: "critical", HIGH: "high", MODERATE: "medium", MEDIUM: "medium", LOW: "low",
  };
  return map[sev.toUpperCase()] ?? cvssToSeverity(cvssScore(vuln.severity));
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function sourceTag(id: string): "OSV" | "GHSA" | "NVD" | "OTHER" {
  if (id.startsWith("GHSA-")) return "GHSA";
  if (id.startsWith("CVE-"))  return "NVD";
  return "OSV";
}

const SOURCE_STYLES = {
  GHSA:  "text-violet-700 bg-violet-500/10 dark:text-violet-400 border border-violet-500/15",
  NVD:   "text-slate-600 bg-slate-500/10 dark:text-slate-400 border border-slate-500/15",
  OSV:   "text-emerald-700 bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/15",
  OTHER: "text-slate-600 bg-slate-500/10 dark:text-slate-400 border border-slate-500/15",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pkg?: string; version?: string; source?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `${id} — Bundle Scan`, description: `Vulnerability details for ${id}` };
}

async function VulnContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pkg?: string; version?: string; source?: string }>;
}) {
  const [{ id }, { pkg: fromPkg, version: fromVersion, source: fromSource }] = await Promise.all([params, searchParams]);

  // Try OSV first for all IDs (OSV indexes GHSA + many CVEs)
  const osvRes = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });

  let vuln: OsvVuln | null = osvRes.ok ? await osvRes.json() : null;

  // For NVD-sourced CVEs not in OSV, build a synthetic entry from NVD
  const isCve = id.startsWith("CVE-");
  let nvdCveData: null | {
    score: number; severity: string;
    description: string; published: string; modified?: string;
    references: Array<{ url: string; tags?: string[] }>;
  } = null;

  if (isCve) {
    try {
      const nvdRes = await fetch(
        `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${id}`,
        { next: { revalidate: 86400 } }
      );
      if (nvdRes.ok) {
        const nvdData = await nvdRes.json();
        const cve = nvdData.vulnerabilities?.[0]?.cve;
        if (cve) {
          const v31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
          const v30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
          const v2  = cve.metrics?.cvssMetricV2?.[0]?.cvssData;
          const nvdScore: number | undefined = v31?.baseScore ?? v30?.baseScore ?? v2?.baseScore;
          const nvdSev: string = v31?.baseSeverity ?? v30?.baseSeverity ?? cve.metrics?.cvssMetricV2?.[0]?.baseSeverity ?? "";
          if (nvdScore !== undefined) {
            nvdCveData = {
              score: nvdScore,
              severity: nvdSev,
              description: cve.descriptions?.find((d: { lang: string; value: string }) => d.lang === "en")?.value ?? "",
              published: cve.published ?? "",
              modified: cve.lastModified,
              references: cve.references ?? [],
            };
          }
          // If OSV didn't have it, build a synthetic vuln from NVD
          if (!vuln && nvdCveData) {
            vuln = {
              id,
              aliases: [],
              summary: nvdCveData.description.slice(0, 300),
              details: nvdCveData.description,
              severity: nvdScore !== undefined ? [{ type: "CVSS_V3", score: String(nvdScore) }] : [],
              affected: [],
              references: nvdCveData.references.map((r) => ({
                type: r.tags?.includes("Patch") ? "FIX" : r.tags?.[0]?.toUpperCase() ?? "WEB",
                url: r.url,
              })),
              published: nvdCveData.published,
              modified: nvdCveData.modified,
            };
          }
        }
      }
    } catch { /* non-fatal */ }
  }

  if (!vuln) notFound();

  let severity = dbSeverity(vuln!);
  let score = cvssScore(vuln!.severity);

  // Use NVD CVSS when OSV lacks severity
  if ((severity === "unknown" || score === null) && nvdCveData) {
    score = nvdCveData.score;
    severity = cvssToSeverity(nvdCveData.score);
  }

  // For non-CVE IDs, still try NVD via any CVE alias
  if ((severity === "unknown" || score === null) && !isCve) {
    const cveAlias = (vuln!.aliases ?? []).find((a) => a.startsWith("CVE-"));
    if (cveAlias) {
      try {
        const nvdRes = await fetch(
          `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveAlias}`,
          { next: { revalidate: 86400 } }
        );
        if (nvdRes.ok) {
          const nvdData = await nvdRes.json();
          const cve = nvdData.vulnerabilities?.[0]?.cve;
          const v31 = cve?.metrics?.cvssMetricV31?.[0]?.cvssData;
          const v30 = cve?.metrics?.cvssMetricV30?.[0]?.cvssData;
          const v2  = cve?.metrics?.cvssMetricV2?.[0]?.cvssData;
          const nvdScore: number | undefined = v31?.baseScore ?? v30?.baseScore ?? v2?.baseScore;
          if (nvdScore !== undefined) { score = nvdScore; severity = cvssToSeverity(nvdScore); }
        }
      } catch { /* non-fatal */ }
    }
  }

  const s = SEV_STYLES[severity];
  const src = sourceTag(vuln.id);

  const fixedVersions = Array.from(
    new Set(
      (vuln.affected ?? []).flatMap((a) =>
        (a.ranges ?? [])
          .filter((r) => r.type === "SEMVER" || r.type === "ECOSYSTEM")
          .flatMap((r) => r.events.filter((e) => e.fixed).map((e) => e.fixed!))
      )
    )
  );

  // Fallback: derive "upgrade above X" from the highest affected version
  const lastAffectedVersion =
    fixedVersions.length === 0
      ? (() => {
          const all = (vuln.affected ?? []).flatMap((a) => a.versions ?? []);
          if (!all.length) return null;
          return all.reduce((best, v) => {
            const cmp = v.localeCompare(best, undefined, { numeric: true, sensitivity: "base" });
            return cmp > 0 ? v : best;
          });
        })()
      : null;

  const affectedPackages = (vuln.affected ?? [])
    .filter((a) => a.package)
    .map((a) => {
      const introduced = (a.ranges ?? [])
        .filter((r) => r.type === "SEMVER" || r.type === "ECOSYSTEM")
        .flatMap((r) => r.events.filter((e) => e.introduced && e.introduced !== "0").map((e) => e.introduced!));
      const fixed = (a.ranges ?? [])
        .filter((r) => r.type === "SEMVER" || r.type === "ECOSYSTEM")
        .flatMap((r) => r.events.filter((e) => e.fixed).map((e) => e.fixed!));
      return { pkg: a.package, introduced: introduced[0], fixed: fixed[0] };
    });

  return (
    <>
      {/* Hero header */}
      <div className={`relative border-b ${s.headerBorder} bg-white/60 dark:bg-surface-dark/60 backdrop-blur-2xl overflow-hidden`}>
        {/* Animated accent line */}
        <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${s.headerAccent} to-transparent animate-glow-breathe`} style={{ transformOrigin: "center" }} />
        {/* Primary glow orb — slow breathe */}
        <div className={`absolute -top-24 left-1/2 w-[700px] h-56 rounded-full ${s.headerGlow} blur-3xl pointer-events-none animate-glow-breathe-slow`} />
        {/* Secondary tighter orb — faster breathe, offset phase */}
        <div className={`absolute -top-10 left-1/2 w-[380px] h-36 rounded-full ${s.headerGlowInner} blur-2xl pointer-events-none animate-glow-breathe`} />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-6 sm:pt-6 sm:pb-7">
          <div className="flex items-center justify-between gap-4 mb-5">
            <BackButton />

            {fromPkg && fromVersion && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/8 text-xs text-slate-500 dark:text-slate-400">
                {fromSource && (
                  <span className={`text-xxs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${SOURCE_STYLES[fromSource as keyof typeof SOURCE_STYLES] ?? SOURCE_STYLES.OTHER}`}>
                    {fromSource}
                  </span>
                )}
                Found in
                <code className="font-mono font-semibold text-slate-800 dark:text-slate-200">{fromPkg}</code>
                <span className="text-slate-300 dark:text-slate-600">@</span>
                <code className="font-mono text-slate-600 dark:text-slate-400">{fromVersion}</code>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`text-xxs font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide ${SOURCE_STYLES[src]}`}>
                {src === "OTHER" ? "OSV" : src}
              </span>
              <h1 className="font-mono text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {vuln.id}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Glass severity badge with animated border */}
              {(severity !== "unknown" || score !== null) && (
                <div className="relative inline-flex rounded-xl overflow-hidden p-px">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="aspect-square w-[200%] flex-shrink-0 animate-border-rotate"
                      style={{
                        background: `conic-gradient(transparent 60%, ${s.tailColor} 73%, white 80%, ${s.tailColor} 87%, transparent 100%)`,
                      }}
                    />
                  </div>
                  <div className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-[calc(1rem-2px)] bg-white dark:bg-surface-dark">
                    {score !== null && (
                      <>
                        <span className={`text-sm font-black tabular-nums ${s.text}`}>{score.toFixed(1)}</span>
                        <span className="text-xxs font-medium text-white/40 dark:text-white/30">/ 10</span>
                        <span className={`w-px h-3 opacity-20 ${s.dot}`} />
                      </>
                    )}
                    {severity !== "unknown" && (
                      <span className={`text-xs font-bold uppercase tracking-widest ${s.text}`}>{severity}</span>
                    )}
                    <span className={`w-px h-3 opacity-20 ${s.dot}`} />
                    <span className="text-xxs font-medium text-slate-400 dark:text-white/30">CVSS v3</span>
                  </div>
                </div>
              )}

              {/* Alias chips */}
              {(vuln.aliases ?? []).map((alias) => (
                <span
                  key={alias}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label font-mono font-medium bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/8"
                >
                  <Tag className="size-2.5 opacity-50" />
                  {alias}
                </span>
              ))}
            </div>

            {vuln.summary && (
              <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed max-w-3xl">
                {vuln.summary}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-xs text-slate-400 dark:text-slate-500">
              {vuln.published && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 flex-shrink-0" />
                  Published {formatDate(vuln.published)}
                </span>
              )}
              {vuln.modified && vuln.modified !== vuln.published && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 flex-shrink-0 opacity-50" />
                  Updated {formatDate(vuln.modified)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          <div className="lg:col-span-2 space-y-4">
            {vuln.details && (
              <div className="relative rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 backdrop-blur-xl shadow-sm overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/15 to-transparent pointer-events-none" />
                <div className="p-5">
                  <p className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 select-none">Description</p>
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 dark:prose-code:bg-white/8 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs">
                    <Markdown>{vuln.details}</Markdown>
                  </div>
                </div>
              </div>
            )}

            {(vuln.references ?? []).length > 0 && (
              <div className="relative rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 backdrop-blur-xl shadow-sm overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/15 to-transparent pointer-events-none" />
                <div className="p-5">
                  <p className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 select-none">References</p>
                  <ul className="space-y-2">
                    {vuln.references!.map((ref, i) => (
                      <li key={i} className="flex items-start gap-2.5 group">
                        <span className="mt-0.5 text-xxs font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/6 text-slate-500 dark:text-slate-400 uppercase tracking-wide flex-shrink-0">
                          {REF_LABELS[ref.type] ?? ref.type}
                        </span>
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline break-all flex items-center gap-1 min-w-0"
                        >
                          <span className="truncate">{ref.url}</span>
                          <ExternalLink className="size-3 flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {(fixedVersions.length > 0 || lastAffectedVersion) && (
              fixedVersions.length > 0 ? (
                <div className="relative rounded-2xl border border-emerald-500/20 dark:border-emerald-500/15 bg-emerald-500/5 dark:bg-emerald-500/8 backdrop-blur-xl overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none" />
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="size-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold leading-none">✓</span>
                      </span>
                      <p className="text-label font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest select-none">Fixed in</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {fixedVersions.map((v) => (
                        <code key={v} className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-emerald-500/10 border border-emerald-500/20 font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          {v}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-2xl border border-amber-500/25 dark:border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/8 backdrop-blur-xl overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent pointer-events-none" />
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="size-5 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                        <span className="text-amber-600 dark:text-amber-400 text-xs font-bold leading-none">!</span>
                      </span>
                      <p className="text-label font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest select-none">Upgrade required</p>
                    </div>
                    <p className="text-xs text-amber-700/70 dark:text-amber-400/60 mb-3 leading-snug pl-7">
                      No exact fix version known. Last confirmed affected:
                    </p>
                    <div className="pl-7">
                      <code className="inline-block px-2.5 py-1 rounded-lg bg-white/80 dark:bg-amber-500/10 border border-amber-500/20 font-mono text-sm font-semibold text-amber-700 dark:text-amber-400">
                        {lastAffectedVersion}
                      </code>
                    </div>
                    <p className="text-xs text-amber-700/60 dark:text-amber-400/50 mt-3 leading-snug pl-7">
                      Upgrade to any version released after this one.
                    </p>
                  </div>
                </div>
              )
            )}

            {affectedPackages.length > 0 && (
              <div className="relative rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 backdrop-blur-xl shadow-sm overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/15 to-transparent pointer-events-none" />
                <div className="p-5">
                  <p className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 select-none">Affected packages</p>
                  <ul className="space-y-3">
                    {affectedPackages.map(({ pkg, introduced, fixed: fixedV }, i) => {
                      const ecosystemSlug: Record<string, string> = {
                        "npm": "npm", "PyPI": "pypi", "Maven": "maven",
                      };
                      const registrySlug = ecosystemSlug[pkg.ecosystem];
                      const pkgHref = registrySlug ? `/${registrySlug}/${pkg.name}` : null;
                      return (
                        <li key={i} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-2">
                            {pkgHref ? (
                              <a
                                href={pkgHref}
                                className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                              >
                                {pkg.name}
                              </a>
                            ) : (
                              <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{pkg.name}</span>
                            )}
                            <span className="text-xxs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/7 px-1.5 py-0.5 rounded flex-shrink-0">
                              {pkg.ecosystem}
                            </span>
                          </div>
                          {(introduced || fixedV) && (
                            <div className="flex items-center gap-1.5 text-xxs font-mono text-slate-400 dark:text-slate-500">
                              {introduced && <span className="text-red-500 dark:text-red-400">≥ {introduced}</span>}
                              {introduced && fixedV && <span className="opacity-40">·</span>}
                              {fixedV && <span className="text-emerald-600 dark:text-emerald-400">&lt; {fixedV}</span>}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            <a
              href={
                vuln.id.startsWith("GHSA-")
                  ? `https://github.com/advisories/${vuln.id}`
                  : `https://osv.dev/vulnerability/${vuln.id}`
              }
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-2 w-full px-4 py-3 rounded-xl border border-black/7 dark:border-white/7 bg-white/70 dark:bg-white/4 hover:bg-white/90 dark:hover:bg-white/6 hover:border-indigo-300 dark:hover:border-indigo-500/20 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
            >
              <span>View on {vuln.id.startsWith("GHSA-") ? "GitHub Advisory DB" : "OSV.dev"}</span>
              <ExternalLink className="size-3.5 flex-shrink-0 opacity-50" />
            </a>
          </div>

        </div>
      </div>
    </>
  );
}

export default function VulnPage({ params, searchParams }: PageProps) {
  return (
    <main className="flex-1">
      <Suspense>
        <VulnContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
