"use client";

import { useEffect, useRef, useState } from "react";
import { useBundleData } from "./BundleDataProvider";

function formatBytes(bytes: number): { value: string; unit: string } {
  if (bytes < 1024) return { value: bytes.toFixed(0), unit: "B" };
  if (bytes < 1024 * 1024) return { value: (bytes / 1024).toFixed(1), unit: "kB" };
  return { value: (bytes / 1024 / 1024).toFixed(2), unit: "MB" };
}

function downloadTime(bytes: number, kbps: number): string {
  const secs = bytes / ((kbps * 1024) / 8);
  if (secs < 0.01) return "< 1 ms";
  if (secs < 1) return `${(secs * 1000).toFixed(0)} ms`;
  return `${secs.toFixed(1)} s`;
}

function useCountUp(target: number, duration = 750) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    if (target === prevTargetRef.current) return;
    prevTargetRef.current = target;
    startRef.current = null;
    cancelAnimationFrame(rafRef.current);

    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

function StatBlock({
  label,
  bytes,
  accent,
}: {
  label: string;
  bytes: number;
  accent?: string;
}) {
  const animated = useCountUp(bytes);
  const { value, unit } = formatBytes(animated);
  return (
    <div className="flex-1 text-center">
      <div
        className={`text-bundle font-bold tabular-nums tracking-[-0.03em] leading-none ${accent ?? "text-slate-900 dark:text-slate-100"}`}
      >
        {value}
        <span className="text-lg font-semibold text-slate-400 dark:text-slate-500 ml-1">
          {unit}
        </span>
      </div>
      <div className="text-xxs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-2">
        {label}
      </div>
    </div>
  );
}

const PHASE_LABEL: Record<string, string> = {
  idle: "Starting…",
  installing: "Installing…",
  bundling: "Bundling…",
};

export function BundleSectionHeader() {
  const { loading, phase } = useBundleData();
  const label = PHASE_LABEL[phase] ?? "Loading…";
  return (
    <div className="flex items-center justify-between mb-4">
      <p className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest select-none">
        Bundle size
      </p>
      {loading && (
        <span className="inline-flex items-center gap-1.5 text-xxs font-medium text-slate-400 dark:text-slate-500">
          <span className="inline-block size-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          {label}
        </span>
      )}
    </div>
  );
}

function BundleSkeleton() {
  return (
    <div className="space-y-5">
      <div className="animate-pulse flex justify-around gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="flex-1 text-center space-y-2">
            <div className="h-10 rounded-lg bg-slate-200/80 dark:bg-white/6 mx-auto w-28" />
            <div className="h-2.5 rounded bg-slate-200/80 dark:bg-white/6 mx-auto w-16" />
          </div>
        ))}
      </div>
      <div className="h-1 rounded-full bg-slate-100 dark:bg-white/4" />
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <div className="h-3 w-32 rounded bg-slate-200/80 dark:bg-white/6" />
              <div className="h-3 w-12 rounded bg-slate-200/80 dark:bg-white/6" />
            </div>
            <div className="h-1 rounded-full bg-slate-100 dark:bg-white/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompositionBars({
  composition,
  total,
  animate,
}: {
  composition: Array<{ name: string; bytes: number }>;
  total: number;
  animate: boolean;
}) {
  if (!composition.length) return null;
  return (
    <div className="mt-5 pt-5 border-t border-black/5 dark:border-white/6">
      <p className="text-xxs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
        Composition
      </p>
      <ul className="space-y-2.5">
        {composition.map((dep) => {
          const pct = Math.min(100, (dep.bytes / total) * 100);
          const { value, unit } = formatBytes(dep.bytes);
          return (
            <li key={dep.name}>
              <div className="flex justify-between mb-1">
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate max-w-[65%]">
                  {dep.name}
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-mono text-label tabular-nums">
                  {value} {unit}
                </span>
              </div>
              <div className="h-1 rounded-full bg-slate-100 dark:bg-white/6 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  style={{
                    width: animate ? `${pct}%` : "0%",
                    transition: animate ? "width 800ms cubic-bezier(0.16,1,0.3,1)" : "none",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function BundleClient({
  name: _name,
  version: _version,
}: {
  name: string;
  version: string;
}) {
  const { result, loading, phase, error } = useBundleData();
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    if (!loading && result?.ok) {
      // tiny delay so bars animate in after paint
      const id = setTimeout(() => setBarsVisible(true), 50);
      return () => clearTimeout(id);
    }
  }, [loading, result]);

  if (!loading && error) {
    return (
      <p className="text-body-sm text-slate-400 py-2">
        Unable to compute bundle size: Network error
      </p>
    );
  }

  if (loading || !result) return <BundleSkeleton />;

  if (!result.ok) {
    return (
      <p className="text-body-sm text-slate-400 py-2">
        Unable to compute bundle size: {result.detail}
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-4 py-1">
        <StatBlock label="Minified" bytes={result.minSize} />
        <div className="w-px bg-black/6 dark:bg-white/6 self-stretch" />
        <StatBlock
          label="Gzipped"
          bytes={result.gzipSize}
          accent="bg-gradient-to-br from-indigo-600 to-violet-500 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400"
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-slate-400 dark:text-slate-500">
        <span>
          Slow 3G:{" "}
          <strong className="text-slate-600 dark:text-slate-300 font-semibold">
            {downloadTime(result.gzipSize, 50)}
          </strong>
        </span>
        <span>
          4G:{" "}
          <strong className="text-slate-600 dark:text-slate-300 font-semibold">
            {downloadTime(result.gzipSize, 875)}
          </strong>
        </span>
      </div>

      <CompositionBars
        composition={result.composition}
        total={result.minSize}
        animate={barsVisible}
      />
    </div>
  );
}
