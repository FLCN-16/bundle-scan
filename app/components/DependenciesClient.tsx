"use client";

import { useEffect, useRef, useState } from "react";
import { Check, AlertTriangle, Wrench } from "lucide-react";
import { useBundleData } from "./BundleDataProvider";
import type { SecurityResult, Severity } from "@/lib/types";

interface DepInfo {
  unpackedSize?: number;
  minified?: number;
  gzipSize?: number;
  resolvedVersion?: string;
  security?: SecurityResult;
}

type RowState = "pending" | "loading" | "done" | "error";

interface DepRow {
  name: string;
  range: string;
  transitive?: boolean;
  bundledBytes?: number;
  state: RowState;
  info?: DepInfo;
}

const CONCURRENCY = 4;

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "unknown"];

const SEV_STYLE: Record<Severity, { bg: string; text: string; dot: string }> = {
  critical: {
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  high: {
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  medium: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  low: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  unknown: {
    bg: "bg-slate-500/8",
    text: "text-slate-500 dark:text-slate-400",
    dot: "bg-slate-400",
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function pkgHref(registry: string, name: string, version?: string): string {
  const base = `/${registry}/${encodeURIComponent(name).replace(/%40/g, "@").replace(/%2F/g, "/")}`;
  return version ? `${base}@${version}` : base;
}

function SkeletonCell({ width = "w-16" }: { width?: string }) {
  return (
    <div
      className={`h-4 rounded-md bg-slate-200/80 dark:bg-white/6 animate-pulse ${width}`}
    />
  );
}

function VulnCell({ security }: { security: SecurityResult }) {
  const advisories = security.advisories;
  if (!advisories.length) {
    return (
      <span className="inline-flex items-center gap-1 text-label text-emerald-600 dark:text-emerald-400 font-medium">
        <Check className="size-3 stroke-[2.5]" />
        Clean
      </span>
    );
  }

  const counts: Partial<Record<Severity, number>> = {};
  for (const adv of advisories) {
    counts[adv.severity] = (counts[adv.severity] ?? 0) + 1;
  }

  const hasFixAvailable = advisories.some((a) => a.fixedVersions.length > 0);
  const fixVersions = [
    ...new Set(advisories.flatMap((a) => a.fixedVersions)),
  ].slice(0, 3);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SEV_ORDER.filter((s) => counts[s]).map((sev) => {
        const st = SEV_STYLE[sev];
        return (
          <span
            key={sev}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xxs font-bold tracking-tight border border-current/10 ${st.bg} ${st.text}`}
          >
            <span className={`size-1.5 rounded-full ${st.dot}`} />
            {sev.charAt(0).toUpperCase() + sev.slice(1)} {counts[sev]}
          </span>
        );
      })}
      {hasFixAvailable && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xxs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/15"
          title={`Fix available: ${fixVersions.join(", ")}`}
        >
          <Wrench className="size-2.5" />
          Fix: {fixVersions.join(", ")}
        </span>
      )}
    </div>
  );
}

function DepTableRow({ row, registry }: { row: DepRow; registry: string }) {
  const isLoading = row.state === "loading" || row.state === "pending";
  return (
    <tr className="border-b border-black/4 dark:border-white/4 last:border-0 hover:bg-slate-50/60 dark:hover:bg-white/2 transition-colors">
      {/* Package name */}
      <td className="py-2.5 pr-3 pl-1">
        <div className="flex items-center gap-1.5">
          <a
            href={pkgHref(registry, row.name, row.info?.resolvedVersion)}
            className="font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[180px] sm:max-w-none"
          >
            {row.name}
          </a>
          {row.transitive && (
            <span className="shrink-0 text-xxs font-semibold px-1 py-px rounded bg-slate-100 dark:bg-white/6 text-slate-400 dark:text-slate-500">
              transitive
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {row.range !== "—" && (
            <span className="font-mono text-xxs text-slate-400 dark:text-slate-500">{row.range}</span>
          )}
          {row.info?.resolvedVersion && (
            <span className="font-mono text-xxs text-slate-500 dark:text-slate-400">
              {row.range !== "—" && <span className="mr-0.5 text-slate-300 dark:text-slate-600">→</span>}
              v{row.info.resolvedVersion}
            </span>
          )}
        </div>
      </td>

      {/* Package size */}
      <td className="py-2.5 pr-4 whitespace-nowrap align-top pt-2.5">
        {isLoading ? (
          <div className="space-y-1.5">
            <SkeletonCell width="w-14" />
            <SkeletonCell width="w-12" />
            <SkeletonCell width="w-10" />
          </div>
        ) : row.info?.unpackedSize != null || row.info?.minified != null || row.info?.gzipSize != null || row.bundledBytes != null ? (
          <div className="space-y-0.5">
            {row.info?.unpackedSize != null && (
              <div className="flex items-center gap-1">
                <span className="text-micro font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 w-14">
                  Unpacked
                </span>
                <span className="text-label text-slate-600 dark:text-slate-300 tabular-nums font-medium">
                  {formatBytes(row.info.unpackedSize)}
                </span>
              </div>
            )}
            {row.info?.minified != null && (
              <div className="flex items-center gap-1">
                <span className="text-micro font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 w-14">
                  Minified
                </span>
                <span className="text-label text-sky-600 dark:text-sky-400 tabular-nums font-medium">
                  {formatBytes(row.info.minified)}
                </span>
              </div>
            )}
            {row.info?.gzipSize != null && (
              <div className="flex items-center gap-1">
                <span className="text-micro font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 w-14">
                  Min+Gzip
                </span>
                <span className="text-label text-emerald-600 dark:text-emerald-400 tabular-nums font-medium">
                  {formatBytes(row.info.gzipSize)}
                </span>
              </div>
            )}
            {row.bundledBytes != null && row.info?.minified == null && row.info?.unpackedSize == null && (
              <div className="flex items-center gap-1">
                <span className="text-micro font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 w-14">
                  Bundled
                </span>
                <span className="text-label text-slate-600 dark:text-slate-300 tabular-nums font-medium">
                  {formatBytes(row.bundledBytes)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-label text-slate-300 dark:text-slate-600">
            —
          </span>
        )}
      </td>

      {/* Vulnerabilities */}
      <td className="py-2.5 align-top pt-2.5">
        {isLoading ? (
          <div className="flex gap-1.5">
            <SkeletonCell width="w-16" />
            <SkeletonCell width="w-12" />
          </div>
        ) : row.state === "error" ? (
          <span className="inline-flex items-center gap-1 text-label text-slate-400">
            <AlertTriangle className="size-3" />
            Unavailable
          </span>
        ) : row.info?.security ? (
          <VulnCell security={row.info.security} />
        ) : null}
      </td>
    </tr>
  );
}

interface Props {
  dependencies: Record<string, string>;
  registry: string;
  ecosystem: string;
}

export function DependenciesClient({
  dependencies,
  registry,
  ecosystem,
}: Props) {
  const directEntries = Object.entries(dependencies);
  const { result: bundleResult, loading: bundleLoading } = useBundleData();

  // Build initial rows: direct deps first, then transitive from bundle composition
  const buildRows = (composition: Array<{ name: string; bytes: number; version?: string }> | undefined): DepRow[] => {
    const directNames = new Set(directEntries.map(([n]) => n));
    const direct: DepRow[] = directEntries.map(([name, range]) => ({ name, range, state: "pending" }));
    const transitive: DepRow[] = (composition ?? [])
      .filter(({ name }) => !directNames.has(name))
      .sort((a, b) => b.bytes - a.bytes)
      .map(({ name, bytes, version }) => ({
        name, range: "—", transitive: true, bundledBytes: bytes, state: "pending",
        ...(version ? { info: { resolvedVersion: version } } : {}),
      }));
    return [...direct, ...transitive];
  };

  const [rows, setRows] = useState<DepRow[]>(() => buildRows(undefined));
  const processedCompositionRef = useRef(false);

  // When bundle result arrives, add transitive rows that aren't already present
  useEffect(() => {
    if (bundleLoading || !bundleResult || processedCompositionRef.current) return;
    if (!bundleResult.ok) return;
    processedCompositionRef.current = true;
    setRows((prev) => {
      const existing = new Set(prev.map((r) => r.name));
      const transitive = bundleResult.composition
        .filter(({ name }) => !existing.has(name))
        .sort((a, b) => b.bytes - a.bytes)
        .map(({ name, bytes, version }) => ({
          name, range: "—", transitive: true, bundledBytes: bytes, state: "pending" as RowState,
          ...(version ? { info: { resolvedVersion: version } } : {}),
        }));
      if (!transitive.length) return prev;
      return [...prev, ...transitive];
    });
  }, [bundleResult, bundleLoading]);

  const queueRef = useRef<number[]>([]);
  const activeRef = useRef(0);
  const mountedRef = useRef(true);
  const rowsRef = useRef<DepRow[]>(rows);
  rowsRef.current = rows;

  const updateRow = (idx: number, patch: Partial<DepRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  // Stored in a ref so .finally() callbacks always drain the shared queue.
  const processNextRef = useRef<() => void>(null!);
  processNextRef.current = () => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const idx = queueRef.current.shift()!;
      const row = rowsRef.current[idx];
      if (!row) continue;
      activeRef.current++;

      updateRow(idx, { state: "loading" });

      const params = new URLSearchParams({ name: row.name, version: row.transitive ? "*" : row.range, ecosystem });
      fetch(`/api/dep-info/npm?${params}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: DepInfo) => {
          if (!mountedRef.current) return;
          updateRow(idx, { state: "done", info: data });
        })
        .catch(() => {
          if (!mountedRef.current) return;
          updateRow(idx, { state: "error" });
        })
        .finally(() => {
          if (!mountedRef.current) return;
          activeRef.current--;
          processNextRef.current();
        });
    }
  };

  // Push newly pending rows onto the shared queue and kick off processing.
  useEffect(() => {
    if (!mountedRef.current) return;
    const pendingIdxs = rows.reduce<number[]>((acc, r, i) => {
      if (r.state === "pending") acc.push(i);
      return acc;
    }, []);
    if (!pendingIdxs.length) return;
    queueRef.current.push(...pendingIdxs);
    processNextRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  if (!rows.length && directEntries.length === 0) return null;

  const directCount = directEntries.length;
  const transitiveCount = rows.filter((r) => r.transitive).length;
  const doneCount = rows.filter((r) => r.state === "done" || r.state === "error").length;
  const vulnCount = rows.reduce((n, r) => n + (r.info?.security?.advisories.length ?? 0), 0);
  const fixCount = rows.reduce(
    (n, r) => n + (r.info?.security?.advisories.filter((a) => a.fixedVersions.length > 0).length ?? 0),
    0,
  );

  return (
    <div>
      {/* Header summary */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none">
          Dependencies
          <span className="ml-1.5 font-normal normal-case tracking-normal">
            ({directCount} direct{transitiveCount > 0 ? `, ${transitiveCount} transitive` : ""})
          </span>
        </p>
        {doneCount > 0 && doneCount < rows.length && (
          <span className="text-label text-slate-400 dark:text-slate-500">
            Scanning {doneCount}/{rows.length}…
          </span>
        )}
        {doneCount === rows.length && rows.length > 0 && vulnCount > 0 && (
          <span className="inline-flex items-center gap-1 text-label font-semibold text-orange-600 dark:text-orange-400">
            <AlertTriangle className="size-3" />
            {vulnCount} vuln{vulnCount !== 1 ? "s" : ""} across dependencies
            {fixCount > 0 && (
              <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                · {fixCount} fixable
              </span>
            )}
          </span>
        )}
        {doneCount === rows.length && rows.length > 0 && vulnCount === 0 && (
          <span className="inline-flex items-center gap-1 text-label font-semibold text-emerald-600 dark:text-emerald-400">
            <Check className="size-3 stroke-[2.5]" />
            All clean
          </span>
        )}
      </div>

      <div className="overflow-x-auto -mx-5 px-5">
        <table className="w-full min-w-[520px] text-left border-collapse">
          <thead>
            <tr className="border-b border-black/6 dark:border-white/6">
              <th className="pb-2 pl-1 pr-3 text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Package
              </th>
              <th className="pb-2 pr-4 text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Size
              </th>
              <th className="pb-2 text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Vulnerabilities
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <DepTableRow key={row.name} row={row} registry={registry} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
