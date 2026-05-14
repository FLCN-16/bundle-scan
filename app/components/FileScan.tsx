"use client";

import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle, RotateCcw, FileText, ShieldAlert, ShieldCheck, Package, Copy, ClipboardCheck } from "lucide-react";
import { detectAndParse, detectAppMeta, type ParsedPackage } from "@/lib/parsers";
import { fetchSecurity } from "@/lib/actions/security";
import { fetchPackageSize } from "@/lib/actions/package-size";
import type { Advisory, BundleResult, SecurityResult, Severity } from "@/lib/types";

const ECOSYSTEM_MAP: Record<"npm" | "pypi" | "maven", string> = {
  npm: "npm",
  pypi: "PyPI",
  maven: "Maven",
};

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };

const SEV_PILL: Record<Severity, string> = {
  critical: "text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20",
  high:     "text-orange-600 dark:text-orange-400 bg-orange-500/10 border border-orange-500/20",
  medium:   "text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20",
  low:      "text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20",
  unknown:  "text-slate-500 bg-slate-500/10 border border-slate-500/15",
};

const SEV_BAR: Record<Severity, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-amber-400",
  low:      "bg-blue-400",
  unknown:  "bg-slate-300 dark:bg-slate-600",
};

const SEV_LABEL: Record<Severity, string> = {
  critical: "text-red-600 dark:text-red-400",
  high:     "text-orange-600 dark:text-orange-400",
  medium:   "text-amber-600 dark:text-amber-400",
  low:      "text-blue-600 dark:text-blue-400",
  unknown:  "text-slate-500",
};

type AmbienceMode = "idle" | "scanning" | "low" | "medium" | "high" | "critical" | "clean";

const AMBIENCE: Record<AmbienceMode, { orb1: string; orb2: string; orb3: string; progress: string }> = {
  idle:     { orb1: "transparent",               orb2: "transparent",              orb3: "transparent",              progress: "from-indigo-500 to-violet-500" },
  scanning: { orb1: "rgba(99,102,241,0.22)",      orb2: "rgba(139,92,246,0.14)",    orb3: "rgba(99,102,241,0.08)",    progress: "from-indigo-500 to-violet-500" },
  low:      { orb1: "rgba(59,130,246,0.22)",      orb2: "rgba(99,102,241,0.14)",    orb3: "rgba(59,130,246,0.08)",    progress: "from-blue-400 to-indigo-500" },
  medium:   { orb1: "rgba(245,158,11,0.25)",      orb2: "rgba(234,179,8,0.14)",     orb3: "rgba(245,158,11,0.08)",    progress: "from-amber-400 to-orange-400" },
  high:     { orb1: "rgba(249,115,22,0.28)",      orb2: "rgba(239,68,68,0.16)",     orb3: "rgba(249,115,22,0.10)",    progress: "from-orange-500 to-red-500" },
  critical: { orb1: "rgba(239,68,68,0.32)",       orb2: "rgba(220,38,38,0.22)",     orb3: "rgba(239,68,68,0.12)",     progress: "from-red-500 to-rose-600" },
  clean:    { orb1: "rgba(16,185,129,0.22)",      orb2: "rgba(52,211,153,0.14)",    orb3: "rgba(16,185,129,0.08)",    progress: "from-emerald-400 to-teal-500" },
};

function ScanAmbience({ mode }: { mode: AmbienceMode }) {
  const a = AMBIENCE[mode];
  const isScanning = mode === "scanning";
  const transition = "background 1.4s ease, opacity 1.4s ease";

  return (
    <div className="fixed inset-0 -z-[5] pointer-events-none overflow-hidden">
      <div
        className={isScanning ? "absolute animate-glow-breathe-slow" : "absolute"}
        style={{ top: "-20%", left: "50%", width: "700px", height: "400px", borderRadius: "50%", transform: "translateX(-50%)", background: a.orb1, filter: "blur(120px)", transition }}
      />
      <div style={{ position: "absolute", bottom: "5%", right: "-10%", width: "500px", height: "400px", borderRadius: "50%", background: a.orb2, filter: "blur(100px)", transition }} />
      <div style={{ position: "absolute", top: "40%", left: "-8%", width: "350px", height: "350px", borderRadius: "50%", background: a.orb3, filter: "blur(80px)", transition }} />
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1000) return `${n} B`;
  if (n < 1e6) return `${(n / 1000).toFixed(1)} kB`;
  return `${(n / 1e6).toFixed(2)} MB`;
}

function semverGt(a: string, b: string): boolean {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

function bestFixVersion(advisories: Advisory[]): string | null {
  const versions = advisories.flatMap((a) => a.fixedVersions).filter(Boolean);
  if (!versions.length) return null;
  // smallest version that fixes — prefer the least-disruptive patch upgrade
  return versions.reduce((best, v) => semverGt(best, v) ? v : best, versions[0]);
}

function buildFixCommand(entries: ScanEntry[]): string {
  const fixable = entries
    .filter((e) => e.status === "done" && (e.result?.advisories.length ?? 0) > 0)
    .flatMap((e) => {
      const fix = bestFixVersion(e.result!.advisories);
      return fix ? [{ pkg: e.pkg, fix }] : [];
    });

  if (!fixable.length) return "";

  const npm  = fixable.filter((x) => x.pkg.registry === "npm");
  const pypi = fixable.filter((x) => x.pkg.registry === "pypi");
  const mvn  = fixable.filter((x) => x.pkg.registry === "maven");

  const lines: string[] = [];
  if (npm.length)  lines.push(`npm install ${npm.map((x) => `${x.pkg.name}@${x.fix}`).join(" ")}`);
  if (pypi.length) lines.push(`pip install ${pypi.map((x) => `${x.pkg.name}==${x.fix}`).join(" ")}`);
  if (mvn.length)  lines.push(`# Maven — update pom.xml:\n${mvn.map((x) => `#   ${x.pkg.name}  →  ${x.fix}`).join("\n")}`);
  return lines.join("\n");
}

export interface ScanEntry {
  pkg: ParsedPackage;
  status: "pending" | "scanning" | "done" | "error";
  result?: SecurityResult;
  error?: string;
  // undefined = not yet fetched, null = unavailable
  size?: { min: number; gzip?: number } | null;
}

export interface SavedScan {
  filename: string;
  appName?: string | null;
  appDescription?: string | null;
  entries: ScanEntry[];
  savedAt: number;
  scannedAt?: number;
}

async function fetchNpmBundleSize(name: string, version: string): Promise<{ min: number; gzip: number } | null> {
  try {
    const res = await fetch("/api/bundle/npm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, version }),
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let result: { min: number; gzip: number } | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data: ")) continue;
        const ev = JSON.parse(line.slice(6)) as
          | { type: "progress" }
          | { type: "result"; data: BundleResult | { ok: false } };
        if (ev.type === "result" && ev.data.ok) {
          result = { min: (ev.data as BundleResult).minSize, gzip: (ev.data as BundleResult).gzipSize };
        }
      }
    }
    return result;
  } catch {
    return null;
  }
}

function topSeverity(advisories: Advisory[]): Severity {
  if (!advisories.length) return "unknown";
  return advisories.reduce<Severity>((top, a) => SEV_ORDER[a.severity] < SEV_ORDER[top] ? a.severity : top, "unknown");
}

function EcosystemBadge({ registry }: { registry: string }) {
  const styles: Record<string, string> = {
    npm:   "text-red-600 dark:text-red-400 bg-red-500/8 border-red-500/15",
    pypi:  "text-blue-600 dark:text-blue-400 bg-blue-500/8 border-blue-500/15",
    maven: "text-orange-600 dark:text-orange-400 bg-orange-500/8 border-orange-500/15",
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${styles[registry] ?? "text-slate-500 bg-slate-500/8 border-slate-500/15"}`}>
      {registry}
    </span>
  );
}

function ScanRow({ entry }: { entry: ScanEntry }) {
  const pkg = entry.pkg;
  const total = entry.result?.advisories.length ?? 0;
  const sev = entry.result ? topSeverity(entry.result.advisories) : null;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-black/4 dark:border-white/4 last:border-0">
      <div className={`w-0.5 self-stretch rounded-full flex-shrink-0 ${
        entry.status === "done" && sev ? SEV_BAR[sev] : "bg-slate-200 dark:bg-white/8"
      }`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <a
            href={`/${pkg.registry}/${encodeURIComponent(pkg.name).replace(/%40/g, "@").replace(/%2F/g, "/")}@${pkg.version}`}
            className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
          >
            {pkg.name}
          </a>
          <EcosystemBadge registry={pkg.registry} />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400 dark:text-slate-500">{pkg.version}</span>
          {entry.size != null && (
            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/5 border border-black/5 dark:border-white/6 px-1.5 py-0.5 rounded">
              {fmtBytes(entry.size.min)}
              {entry.size.gzip != null && (
                <span className="opacity-60"> / {fmtBytes(entry.size.gzip)} gz</span>
              )}
            </span>
          )}
          {entry.size === undefined && entry.status !== "pending" && (
            <span className="text-[10px] text-slate-300 dark:text-slate-700">…</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {entry.status === "pending" && <span className="text-xs text-slate-300 dark:text-slate-600">Queued</span>}
        {entry.status === "scanning" && (
          <span className="text-xs text-indigo-500 dark:text-indigo-400 flex items-center justify-end gap-1.5">
            <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Scanning
          </span>
        )}
        {entry.status === "error" && (
          <span className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="size-3.5" />
            {entry.error ?? "Error"}
          </span>
        )}
        {entry.status === "done" && total === 0 && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-end gap-1">
            <Check className="size-3 stroke-[2.5]" />
            Clean
          </span>
        )}
        {entry.status === "done" && total > 0 && sev && (
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEV_PILL[sev]}`}>
              {total} vuln{total !== 1 ? "s" : ""}
            </span>
            {(() => {
              const fix = bestFixVersion(entry.result!.advisories);
              return fix ? (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  fix {fix.split(".").slice(0, 3).join(".")}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-black/6 dark:border-white/6 text-slate-400 dark:text-slate-600">no fix</span>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(value);

  useLayoutEffect(() => {
    if (value === fromRef.current) return;
    const from = fromRef.current;
    fromRef.current = value;
    const duration = 500;
    const startTime = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    function step(now: number) {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value]);

  return <>{format(display)}</>;
}

const CONCURRENCY = 4;

export function FileScan({
  initialFile,
  savedScan,
  scanId,
}: {
  initialFile?: { name: string; content: string };
  savedScan?: SavedScan;
  scanId?: string;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<ScanEntry[]>(savedScan?.entries ?? []);
  const [scanning, setScanning] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(savedScan?.filename ?? null);
  const [appName, setAppName] = useState<string | null>(savedScan?.appName ?? null);
  const [appDescription, setAppDescription] = useState<string | null>(savedScan?.appDescription ?? null);
  const [scannedAt] = useState<number | null>(savedScan?.scannedAt ?? null);
  const [copied, setCopied] = useState(false);
  const hasStarted = useRef(false);
  const savedToStorage = useRef(!!savedScan);
  const [showBundleCard, setShowBundleCard] = useState(() => (savedScan?.entries ?? []).some((e) => e.size != null));

  const updateEntry = useCallback((idx: number, patch: Partial<ScanEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }, []);

  const updateSize = useCallback((idx: number, size: { min: number; gzip?: number } | null) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, size } : e)));
  }, []);

  const handleFile = useCallback(async (name: string, content: string) => {
    setParseError(null);
    setFilename(name);
    const meta = detectAppMeta(name, content);
    setAppName(meta.name);
    setAppDescription(meta.description);
    let packages: ParsedPackage[];
    try {
      packages = detectAndParse(name, content);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file");
      return;
    }
    if (!packages.length) { setParseError("No packages found in file."); return; }

    setEntries(packages.map((pkg) => ({ pkg, status: "pending" })));
    setScanning(true);

    const queue = packages.map((_, i) => i);
    let active = 0, next = 0;

    await new Promise<void>((resolve) => {
      function dispatch() {
        while (active < CONCURRENCY && next < queue.length) {
          const idx = queue[next++];
          active++;
          const pkg = packages[idx];
          updateEntry(idx, { status: "scanning" });

          // Size and security fire in parallel per package slot
          const sizeP = pkg.registry === "npm"
            ? fetchNpmBundleSize(pkg.name, pkg.version)
                .then((s) => updateSize(idx, s))
                .catch(() => updateSize(idx, null))
            : fetchPackageSize(pkg.name, pkg.registry, pkg.version)
                .then((s) => updateSize(idx, s ? { min: s.bytes } : null))
                .catch(() => updateSize(idx, null));

          const secP = fetchSecurity(pkg.name, ECOSYSTEM_MAP[pkg.registry], pkg.version)
            .then((result) => updateEntry(idx, { status: "done", result }))
            .catch((err) => updateEntry(idx, { status: "error", error: err instanceof Error ? err.message : "Error" }));

          // Advance queue only when both are done
          Promise.all([sizeP, secP])
            .finally(() => { active--; if (next < queue.length) dispatch(); else if (active === 0) resolve(); });
        }
      }
      dispatch();
      if (!packages.length) resolve();
    });

    setScanning(false);
  }, [updateEntry, updateSize]);

  useEffect(() => {
    if (initialFile && !hasStarted.current) {
      hasStarted.current = true;
      handleFile(initialFile.name, initialFile.content);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const done = entries.filter((e) => e.status === "done").length;
  const withVulns = entries.filter((e) => e.status === "done" && (e.result?.advisories.length ?? 0) > 0);
  const clean = entries.filter((e) => e.status === "done" && (e.result?.advisories.length ?? 0) === 0);
  const isComplete = done === entries.length && entries.length > 0;

  useEffect(() => {
    if (isComplete && scanId && filename && !savedToStorage.current) {
      savedToStorage.current = true;
      const now = Date.now();
      const payload: SavedScan = { filename, appName, appDescription, entries, savedAt: now, scannedAt: now };
      // fast local cache for same-browser reloads
      try {
        localStorage.setItem(`bundle-scan-result-${scanId}`, JSON.stringify(payload));
      } catch {}
      // durable remote store for shareable links
      fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: scanId, data: payload }),
      }).catch(() => {});
    }
  // entries reference changes each render; only save once isComplete flips true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, scanId]);

  const bundleStats = useMemo(() => {
    const npmEntries = entries.filter((e) => e.pkg.registry === "npm");
    const withSize = npmEntries.filter((e) => e.size != null);
    const totalMin = withSize.reduce((a, e) => a + e.size!.min, 0);
    const totalGzip = withSize.filter((e) => e.size!.gzip != null).reduce((a, e) => a + e.size!.gzip!, 0);
    return { totalMin, totalGzip, sizedCount: withSize.length, npmTotal: npmEntries.length };
  }, [entries]);

  useEffect(() => {
    if (!showBundleCard && bundleStats.sizedCount > 0) setShowBundleCard(true);
  }, [bundleStats.sizedCount, showBundleCard]);

  useEffect(() => {
    if (appName) document.title = `${appName} — Bundle Scan`;
    return () => { document.title = "Scan results — Bundle Scan"; };
  }, [appName]);

  const sevCounts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const e of withVulns) {
      const sev = topSeverity(e.result!.advisories);
      if (sev in c) c[sev as keyof typeof c]++;
    }
    return c;
  }, [withVulns]);

  const liveTopSev: Severity | null = useMemo(() =>
    withVulns.reduce<Severity | null>((top, e) => {
      const sev = topSeverity(e.result!.advisories);
      if (top === null) return sev;
      return SEV_ORDER[sev] < SEV_ORDER[top] ? sev : top;
    }, null),
  [withVulns]);

  const ambienceMode: AmbienceMode = useMemo(() => {
    // "unknown" severity has no AMBIENCE entry — treat it as null
    const sev = liveTopSev && liveTopSev in AMBIENCE ? (liveTopSev as AmbienceMode) : null;
    if (entries.length === 0) return "idle";
    if (scanning) return sev ?? "scanning";
    if (isComplete && withVulns.length === 0) return "clean";
    return sev ?? "idle";
  }, [entries.length, scanning, isComplete, withVulns.length, liveTopSev]);

  const progressGradient = AMBIENCE[ambienceMode].progress;

  const sorted = useMemo(() => [...entries].sort((a, b) => {
    const aV = a.result?.advisories.length ?? 0, bV = b.result?.advisories.length ?? 0;
    if (a.status === "done" && b.status === "done") {
      if (aV > 0 && bV === 0) return -1;
      if (bV > 0 && aV === 0) return 1;
      if (aV > 0 && bV > 0) return SEV_ORDER[topSeverity(a.result!.advisories)] - SEV_ORDER[topSeverity(b.result!.advisories)];
    }
    if (a.status === "scanning") return -1;
    if (b.status === "scanning") return 1;
    return 0;
  }), [entries]);

  const vulnEntries = sorted.filter((e) => e.status === "done" && (e.result?.advisories.length ?? 0) > 0);
  const cleanEntries = sorted.filter((e) => e.status === "done" && (e.result?.advisories.length ?? 0) === 0);
  const inProgressEntries = sorted.filter((e) => e.status === "scanning" || e.status === "pending");

  if (!entries.length) {
    return (
      <>
        <ScanAmbience mode="idle" />
        {parseError && (
          <div className="rounded-xl border border-red-500/15 bg-red-500/8 p-4 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
            {parseError}
          </div>
        )}
        {!parseError && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="size-12 rounded-2xl border border-black/8 dark:border-white/8 bg-white/60 dark:bg-white/5 flex items-center justify-center">
              <Package className="size-5 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-400 dark:text-slate-500">Loading scan…</p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <ScanAmbience mode={ambienceMode} />

      <div className="space-y-3">

        {/* ── Bento row 1: Status card + Bundle size card ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">

          {/* Status card — spans full width until bundle card appears */}
          <div className={`${showBundleCard ? "lg:col-span-2" : "lg:col-span-3"} relative rounded-2xl border border-black/7 dark:border-white/7 bg-white/70 dark:bg-white/4 backdrop-blur-xl overflow-hidden transition-all duration-300`}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/15 to-transparent pointer-events-none" />

            {/* File name + actions */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-7 rounded-lg border border-black/8 dark:border-white/8 bg-white/70 dark:bg-white/6 flex items-center justify-center flex-shrink-0">
                  <FileText className="size-3.5 text-slate-400 dark:text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[280px] leading-tight">
                    {appName ?? filename}
                  </p>
                  {appDescription && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[280px] leading-tight mt-0.5">
                      {appDescription}
                    </p>
                  )}
                  {appName && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[280px] leading-tight">
                      {filename}
                    </p>
                  )}
                </div>
                {scanning ? (
                  <span className="flex items-center gap-1.5 text-xs text-indigo-500 dark:text-indigo-400 font-medium ml-1 flex-shrink-0">
                    <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    Scanning…
                  </span>
                ) : isComplete && withVulns.length === 0 ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium ml-1 flex-shrink-0">
                    <Check className="size-3 stroke-[2.5]" />
                    All clean
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-black/7 dark:border-white/8 bg-white/60 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200 transition-colors flex-shrink-0"
              >
                <RotateCcw className="size-3" />
                New scan
              </button>
            </div>

            {/* Severity counts */}
            <div className="px-5 pb-4 grid grid-cols-4 gap-2">
              {(["critical", "high", "medium", "low"] as const).map((sev) => {
                const count = sevCounts[sev];
                const active = count > 0;
                const colors: Record<string, string> = {
                  critical: active ? "border-red-500/20 bg-red-500/6"    : "border-black/5 dark:border-white/5",
                  high:     active ? "border-orange-500/20 bg-orange-500/6" : "border-black/5 dark:border-white/5",
                  medium:   active ? "border-amber-500/20 bg-amber-500/6"  : "border-black/5 dark:border-white/5",
                  low:      active ? "border-blue-500/20 bg-blue-500/6"   : "border-black/5 dark:border-white/5",
                };
                return (
                  <div key={sev} className={`rounded-xl border px-3 py-2.5 text-center transition-colors duration-500 ${colors[sev]}`}>
                    <p className={`text-xl font-bold tabular-nums leading-none ${active ? SEV_LABEL[sev] : "text-slate-300 dark:text-slate-700"}`}>
                      {count}
                    </p>
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 capitalize tracking-wide">{sev}</p>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-100 dark:bg-white/5 mx-5 mb-3 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r transition-all duration-500 ${progressGradient} ${scanning ? "relative overflow-hidden" : ""}`}
                style={{ width: `${entries.length ? (done / entries.length) * 100 : 0}%` }}
              >
                {scanning && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.4s_ease-in-out_infinite]" />
                )}
              </div>
            </div>

            {/* Progress count + scan date */}
            <div className="px-5 pb-4 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{done}</span>
                {" / "}{entries.length} packages
                {withVulns.length > 0 && (
                  <> · <span className="font-semibold text-red-500 dark:text-red-400">{withVulns.length}</span> vulnerable</>
                )}
              </span>
              {(isComplete || scannedAt) && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums flex-shrink-0">
                  {new Date(scannedAt ?? Date.now()).toLocaleString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Bundle size card — appears once first size arrives */}
          {showBundleCard && (
            <div className="relative rounded-2xl border border-black/7 dark:border-white/7 bg-white/70 dark:bg-white/4 backdrop-blur-xl overflow-hidden p-5 animate-[fadeSlideIn_0.35s_ease-out]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/15 to-transparent pointer-events-none" />

              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Bundle Size</p>
                {scanning && bundleStats.sizedCount < bundleStats.npmTotal && (
                  <span className="flex items-center gap-1.5 text-[10px] text-indigo-500 dark:text-indigo-400 font-medium">
                    <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    Calculating
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/3 p-3 text-center">
                    <p className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100 leading-none">
                      <AnimatedNumber value={bundleStats.totalMin} format={fmtBytes} />
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">minified</p>
                  </div>
                  <div className="rounded-xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/3 p-3 text-center">
                    <p className="text-2xl font-bold tabular-nums text-slate-800 dark:text-slate-100 leading-none">
                      <AnimatedNumber value={bundleStats.totalGzip} format={fmtBytes} />
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">gzip</p>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* ── Bento row 2: Vulnerabilities + Clean ── */}
        {(vulnEntries.length > 0 || (isComplete && cleanEntries.length > 0)) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">

            {/* Vulnerabilities */}
            {vulnEntries.length > 0 && (
              <div className="relative rounded-2xl border border-red-500/15 dark:border-red-500/20 bg-white/80 dark:bg-white/4 backdrop-blur-xl overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/40 to-transparent pointer-events-none" />
                <div className="sticky top-0 z-10 px-5 py-3 bg-white/95 dark:bg-[#0f0f12]/95 backdrop-blur border-b border-red-500/10 dark:border-red-500/15 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-3.5 text-red-500 dark:text-red-400" />
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">Vulnerabilities</p>
                    <span className="text-xs font-bold tabular-nums text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">{vulnEntries.length}</span>
                  </div>
                  {(() => {
                    const cmd = buildFixCommand(vulnEntries);
                    if (!cmd) return null;
                    return (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(cmd);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-black/7 dark:border-white/8 bg-white/60 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      >
                        {copied ? <ClipboardCheck className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                        {copied ? "Copied!" : "Copy fix command"}
                      </button>
                    );
                  })()}
                </div>
                <div className="px-4 max-h-[600px] overflow-y-auto">
                  {vulnEntries.map((e, i) => (
                    <ScanRow key={`vuln-${i}`} entry={e} />
                  ))}
                </div>
              </div>
            )}

            {/* Clean */}
            {isComplete && cleanEntries.length > 0 && (
              <div className="relative rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 backdrop-blur-xl overflow-hidden">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent pointer-events-none" />
                <div className="sticky top-0 z-10 px-5 py-3 bg-white/95 dark:bg-[#0f0f12]/95 backdrop-blur border-b border-emerald-500/10 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Clean</p>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">{cleanEntries.length}</span>
                </div>
                <div className="px-4 max-h-[600px] overflow-y-auto">
                  {cleanEntries.map((e, i) => (
                    <ScanRow key={`clean-${i}`} entry={e} />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </>
  );
}
