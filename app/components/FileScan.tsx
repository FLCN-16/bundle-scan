"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Check, Package, AlertCircle } from "lucide-react";
import { detectAndParse, type ParsedPackage } from "@/lib/parsers";
import { fetchSecurity } from "@/lib/actions/security";
import type { Advisory, SecurityResult, Severity } from "@/lib/types";

const ECOSYSTEM_MAP: Record<"npm" | "pypi" | "maven", string> = {
  npm: "npm",
  pypi: "PyPI",
  maven: "Maven",
};

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };

const SEV_PILL: Record<Severity, string> = {
  critical: "text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/15",
  high:     "text-orange-600 dark:text-orange-400 bg-orange-500/10 border border-orange-500/15",
  medium:   "text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/15",
  low:      "text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/15",
  unknown:  "text-slate-500 bg-slate-500/10 border border-slate-500/15",
};

interface ScanEntry {
  pkg: ParsedPackage;
  status: "pending" | "scanning" | "done" | "error";
  result?: SecurityResult;
  error?: string;
}

function topSeverity(advisories: Advisory[]): Severity {
  if (!advisories.length) return "unknown";
  return advisories.reduce<Severity>((top, a) => SEV_ORDER[a.severity] < SEV_ORDER[top] ? a.severity : top, "unknown");
}

function ScanRow({ entry }: { entry: ScanEntry }) {
  const pkg = entry.pkg;
  const total = entry.result?.advisories.length ?? 0;
  const sev = entry.result ? topSeverity(entry.result.advisories) : null;

  return (
    <div className="flex items-center gap-4 py-2.5 border-b border-black/4 dark:border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <a
          href={`/${pkg.registry}/${encodeURIComponent(pkg.name).replace(/%40/g, "@").replace(/%2F/g, "/")}@${pkg.version}`}
          className="font-mono text-body-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
        >
          {pkg.name}
        </a>
        <span className="text-label text-slate-400 dark:text-slate-500 font-mono">{pkg.version}</span>
      </div>

      <div className="shrink-0 text-right">
        {entry.status === "pending" && <span className="text-xs text-slate-400">Queued</span>}
        {entry.status === "scanning" && (
          <span className="text-xs text-slate-400 flex items-center justify-end gap-1.5">
            <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Scanning…
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
          <span className={`text-label font-semibold px-2 py-0.5 rounded-full ${SEV_PILL[sev]}`}>
            {total} vuln{total !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function DropZone({ onFile, loading }: { onFile: (name: string, content: string) => void; loading: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === "string") onFile(file.name, content);
    };
    reader.readAsText(file);
  }, [onFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 p-6 sm:p-10 text-center ${
        dragging
          ? "border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10"
          : "border-black/8 dark:border-white/8 bg-white/50 dark:bg-white/3 hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:bg-white/70 dark:hover:bg-white/5"
      } ${loading ? "pointer-events-none opacity-50" : ""}`}
    >
      <input ref={inputRef} type="file" accept=".json,.txt,.xml" className="sr-only" onChange={handleChange} />
      <div className="size-11 rounded-xl bg-white/80 dark:bg-white/7 border border-black/7 dark:border-white/8 flex items-center justify-center mx-auto mb-3 shadow-sm">
        <Package className="size-5 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        Drop your dependency file here
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        or click to browse —{" "}
        <span className="font-mono">package.json</span>,{" "}
        <span className="font-mono">requirements.txt</span>,{" "}
        <span className="font-mono">pom.xml</span>
      </p>
    </div>
  );
}

const CONCURRENCY = 4;

export function FileScan({ initialFile }: { initialFile?: { name: string; content: string } }) {
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [scanning, setScanning] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const updateEntry = useCallback((idx: number, patch: Partial<ScanEntry>) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  }, []);

  const handleFile = useCallback(async (name: string, content: string) => {
    setParseError(null);
    setFilename(name);
    let packages: ParsedPackage[];
    try {
      packages = detectAndParse(name, content);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file");
      return;
    }
    if (!packages.length) {
      setParseError("No packages found in file.");
      return;
    }

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
          fetchSecurity(pkg.name, ECOSYSTEM_MAP[pkg.registry], pkg.version)
            .then((result) => updateEntry(idx, { status: "done", result }))
            .catch((err) => updateEntry(idx, { status: "error", error: err instanceof Error ? err.message : "Error" }))
            .finally(() => { active--; if (next < queue.length) dispatch(); else if (active === 0) resolve(); });
        }
      }
      dispatch();
      if (!packages.length) resolve();
    });

    setScanning(false);
  }, [updateEntry]);

  useEffect(() => {
    if (initialFile) handleFile(initialFile.name, initialFile.content);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const reset = () => { setEntries([]); setParseError(null); setFilename(null); setScanning(false); };

  const done = entries.filter((e) => e.status === "done").length;
  const withVulns = entries.filter((e) => e.status === "done" && (e.result?.advisories.length ?? 0) > 0);
  const clean = entries.filter((e) => e.status === "done" && (e.result?.advisories.length ?? 0) === 0);

  const sorted = [...entries].sort((a, b) => {
    const aV = a.result?.advisories.length ?? 0, bV = b.result?.advisories.length ?? 0;
    if (a.status === "done" && b.status === "done") {
      if (aV > 0 && bV === 0) return -1;
      if (bV > 0 && aV === 0) return 1;
      if (aV > 0 && bV > 0) return SEV_ORDER[topSeverity(a.result!.advisories)] - SEV_ORDER[topSeverity(b.result!.advisories)];
    }
    if (a.status === "scanning") return -1;
    if (b.status === "scanning") return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {!entries.length && !initialFile && <DropZone onFile={handleFile} loading={scanning} />}

      {parseError && (
        <div className="rounded-xl border border-red-500/15 bg-red-500/8 p-4 text-body-sm text-red-600 dark:text-red-400 flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
          {parseError}
        </div>
      )}

      {entries.length > 0 && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-body-sm font-medium text-slate-700 dark:text-slate-300">
                {filename && <span className="font-mono text-slate-400 mr-2">{filename}</span>}
                {done}/{entries.length} packages scanned
              </p>
              {done === entries.length && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {withVulns.length > 0
                    ? `${withVulns.length} package${withVulns.length !== 1 ? "s" : ""} with vulnerabilities · ${clean.length} clean`
                    : (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3 stroke-[2.5]" />
                        All packages are clean
                      </span>
                    )}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {scanning && (
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Scanning…
                </span>
              )}
              <button
                onClick={reset}
                className="text-xs px-3 py-1.5 rounded-lg border border-black/7 dark:border-white/8 bg-white/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-white/90 dark:hover:bg-white/8 transition-colors"
              >
                Scan another file
              </button>
            </div>
          </div>

          {/* Progress */}
          {scanning && (
            <div className="h-0.5 rounded-full bg-slate-100 dark:bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
                style={{ width: `${(done / entries.length) * 100}%` }}
              />
            </div>
          )}

          {/* Results */}
          <div className="relative rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 backdrop-blur-xl shadow-sm overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/15 to-transparent pointer-events-none" />

            {withVulns.length > 0 && (
              <div>
                <div className="px-5 py-2.5 bg-red-500/5 border-b border-black/4 dark:border-white/5">
                  <p className="text-label font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">
                    Vulnerabilities found ({withVulns.length})
                  </p>
                </div>
                <div className="px-5">
                  {sorted.filter((e) => e.status === "done" && (e.result?.advisories.length ?? 0) > 0).map((e, i) => (
                    <ScanRow key={`vuln-${i}`} entry={e} />
                  ))}
                </div>
              </div>
            )}

            {entries.some((e) => e.status !== "done" && e.status !== "error") && (
              <div className="px-5">
                {sorted.filter((e) => e.status === "scanning" || e.status === "pending").slice(0, 10).map((e, i) => (
                  <ScanRow key={`pending-${i}`} entry={e} />
                ))}
                {sorted.filter((e) => e.status === "pending").length > 10 && (
                  <p className="text-xs text-slate-400 py-2">
                    + {sorted.filter((e) => e.status === "pending").length - 10} more queued…
                  </p>
                )}
              </div>
            )}

            {clean.length > 0 && (
              <div>
                <div className="px-5 py-2.5 bg-emerald-500/5 border-b border-black/4 dark:border-white/5">
                  <p className="text-label font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                    Clean ({clean.length})
                  </p>
                </div>
                <div className="px-5">
                  {sorted.filter((e) => e.status === "done" && (e.result?.advisories.length ?? 0) === 0).map((e, i) => (
                    <ScanRow key={`clean-${i}`} entry={e} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
