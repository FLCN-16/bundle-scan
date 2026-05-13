"use client";

import { useEffect, useState } from "react";
import type { LangUsageResult } from "@/app/api/lang-usage/route";

function pct(bytes: number, total: number) {
  return ((bytes / total) * 100).toFixed(1);
}

function LanguageBarSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-3 rounded-full bg-slate-200/80 dark:bg-white/6" />
      <div className="space-y-2">
        {[100, 80, 60, 70].map((w) => (
          <div key={w} className="flex items-center gap-2">
            <div className="size-2.5 rounded-sm bg-slate-200/80 dark:bg-white/6 flex-shrink-0" />
            <div className="h-3 rounded bg-slate-200/80 dark:bg-white/6 flex-1" style={{ maxWidth: w }} />
            <div className="h-3 w-8 rounded bg-slate-200/80 dark:bg-white/6 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LanguageBar({ repoUrl }: { repoUrl: string }) {
  const [data, setData] = useState<LangUsageResult | null>(null);
  const [error, setError] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lang-usage?repo=${encodeURIComponent(repoUrl)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: LangUsageResult) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [repoUrl]);

  if (error) return null;
  if (!data) return <LanguageBarSkeleton />;
  if (!data.languages.length) return null;

  const visible = data.languages.filter((l) => (l.bytes / data.total) * 100 >= 0.5);
  const rest = data.languages.filter((l) => (l.bytes / data.total) * 100 < 0.5);
  const otherBytes = rest.reduce((s, l) => s + l.bytes, 0);
  const shownVisible = visible.slice(0, 8);
  const hiddenBytes = otherBytes + visible.slice(8).reduce((s, l) => s + l.bytes, 0);
  const hasOther = rest.length > 0 || visible.length > 8;

  return (
    <div className="space-y-4">
      {/* Segmented bar with background track */}
      <div
        className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-white/5"
        role="img"
        aria-label="Language usage"
      >
        {visible.map((lang) => (
          <div
            key={lang.name}
            title={`${lang.name}: ${pct(lang.bytes, data.total)}%`}
            style={{ width: `${pct(lang.bytes, data.total)}%`, backgroundColor: lang.color }}
            className={`transition-opacity duration-150 ${hovered && hovered !== lang.name ? "opacity-30" : "opacity-100"}`}
            onMouseEnter={() => setHovered(lang.name)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {otherBytes > 0 && (
          <div
            title={`Other: ${pct(otherBytes, data.total)}%`}
            style={{ width: `${pct(otherBytes, data.total)}%`, backgroundColor: "#8b949e" }}
            className={`transition-opacity duration-150 ${hovered && hovered !== "Other" ? "opacity-30" : "opacity-100"}`}
            onMouseEnter={() => setHovered("Other")}
            onMouseLeave={() => setHovered(null)}
          />
        )}
      </div>

      {/* Legend — vertical list */}
      <ul className="space-y-1.5">
        {shownVisible.map((lang) => (
          <li
            key={lang.name}
            className={`flex items-center gap-2.5 cursor-default transition-opacity duration-150 ${hovered && hovered !== lang.name ? "opacity-30" : "opacity-100"}`}
            onMouseEnter={() => setHovered(lang.name)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="size-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: lang.color }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium flex-1 truncate min-w-0">
              {lang.name}
            </span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums flex-shrink-0">
              {pct(lang.bytes, data.total)}%
            </span>
          </li>
        ))}
        {hasOther && (
          <li
            className={`flex items-center gap-2.5 cursor-default transition-opacity duration-150 ${hovered && hovered !== "Other" ? "opacity-30" : "opacity-100"}`}
            onMouseEnter={() => setHovered("Other")}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="size-2.5 rounded-sm flex-shrink-0 bg-[#8b949e]" />
            <span className="text-xs text-slate-500 dark:text-slate-400 flex-1">Other</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums flex-shrink-0">
              {pct(hiddenBytes, data.total)}%
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
