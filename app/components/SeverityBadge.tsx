import type { Severity } from "@/lib/types";

const STYLES: Record<Severity, string> = {
  critical: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  high:     "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
  medium:   "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  low:      "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  unknown:  "bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20",
};

export function SeverityBadge({ severity, count }: { severity: Severity; count?: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-label font-semibold tracking-tight ${STYLES[severity]}`}>
      <span className="sr-only">severity: </span>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
      {count !== undefined && (
        <span className="bg-current/15 rounded-full px-1.5 py-px text-xxs font-bold">{count}</span>
      )}
    </span>
  );
}
