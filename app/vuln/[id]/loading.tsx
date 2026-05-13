export default function Loading() {
  return (
    <main className="flex-1">
      {/* Header skeleton */}
      <div className="relative border-b border-black/6 dark:border-white/6 bg-white/60 dark:bg-surface-dark/60 backdrop-blur-2xl overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/50 dark:via-white/10 to-transparent" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-6 sm:pt-6 sm:pb-7 animate-pulse">
          {/* Back + found-in row */}
          <div className="flex items-center justify-between gap-4 mb-6">
            <div className="h-3.5 w-10 rounded bg-slate-200/80 dark:bg-white/8" />
            <div className="h-6 w-52 rounded-lg bg-slate-200/80 dark:bg-white/8" />
          </div>

          <div className="flex flex-col gap-4">
            {/* Source badge + ID */}
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-10 rounded-md bg-slate-200/80 dark:bg-white/8" />
              <div className="h-7 w-64 rounded-lg bg-slate-200/80 dark:bg-white/8" />
            </div>

            {/* Severity + CVSS + alias chips */}
            <div className="flex items-center gap-2">
              <div className="h-6 w-20 rounded-full bg-slate-200/80 dark:bg-white/8" />
              <div className="h-6 w-24 rounded-full bg-slate-200/80 dark:bg-white/8" />
              <div className="h-6 w-28 rounded-full bg-slate-200/80 dark:bg-white/8" />
            </div>

            {/* Summary */}
            <div className="space-y-2 max-w-2xl">
              <div className="h-4 w-full rounded bg-slate-200/80 dark:bg-white/8" />
              <div className="h-4 w-4/5 rounded bg-slate-200/80 dark:bg-white/8" />
            </div>

            {/* Dates */}
            <div className="flex gap-4">
              <div className="h-3.5 w-36 rounded bg-slate-200/80 dark:bg-white/8" />
              <div className="h-3.5 w-32 rounded bg-slate-200/80 dark:bg-white/8" />
            </div>
          </div>
        </div>
      </div>

      {/* Body skeleton */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Main — description + references */}
          <div className="lg:col-span-2 space-y-4">
            {/* Description card */}
            <div className="rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 p-5 space-y-3">
              <div className="h-3 w-24 rounded bg-slate-200/80 dark:bg-white/6" />
              <div className="space-y-2 pt-1">
                {[100, 95, 88, 100, 72, 90, 60].map((w, i) => (
                  <div key={i} className="h-3 rounded bg-slate-200/80 dark:bg-white/6" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>

            {/* References card */}
            <div className="rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 p-5 space-y-3">
              <div className="h-3 w-20 rounded bg-slate-200/80 dark:bg-white/6" />
              <div className="space-y-2.5 pt-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="h-4 w-14 rounded bg-slate-200/80 dark:bg-white/6 flex-shrink-0" />
                    <div className="h-3 rounded bg-slate-200/80 dark:bg-white/6 flex-1" style={{ width: `${60 + i * 8}%` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Fix card */}
            <div className="rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 p-5 space-y-3">
              <div className="h-3 w-16 rounded bg-slate-200/80 dark:bg-white/6" />
              <div className="flex flex-wrap gap-1.5">
                {[48, 52, 44].map((w, i) => (
                  <div key={i} className="h-7 rounded-lg bg-slate-200/80 dark:bg-white/6" style={{ width: w }} />
                ))}
              </div>
            </div>

            {/* Affected packages card */}
            <div className="rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 p-5 space-y-3">
              <div className="h-3 w-28 rounded bg-slate-200/80 dark:bg-white/6" />
              <div className="space-y-2 pt-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="h-3 w-28 rounded bg-slate-200/80 dark:bg-white/6" />
                    <div className="h-4 w-12 rounded bg-slate-200/80 dark:bg-white/6" />
                  </div>
                ))}
              </div>
            </div>

            {/* External link */}
            <div className="h-10 w-full rounded-xl bg-slate-200/80 dark:bg-white/6" />
          </div>

        </div>
      </div>
    </main>
  );
}
