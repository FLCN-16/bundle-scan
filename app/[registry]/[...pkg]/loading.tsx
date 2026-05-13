export default function Loading() {
  return (
    <main className="flex-1 bg-slate-50 dark:bg-zinc-950 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="h-4 w-40 rounded bg-slate-200 dark:bg-slate-800 mb-5" />
          <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-slate-800 mb-3" />
          <div className="h-4 w-full max-w-md rounded bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Bundle card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900 p-5">
              <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800 mb-6" />
              <div className="flex justify-around">
                {[1, 2].map((i) => (
                  <div key={i} className="text-center space-y-2">
                    <div className="h-12 w-28 rounded-lg bg-slate-200 dark:bg-slate-800 mx-auto" />
                    <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-800 mx-auto" />
                  </div>
                ))}
              </div>
            </div>
            {/* Deps card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900 p-5">
              <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-800 mb-4" />
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-4 rounded bg-slate-100 dark:bg-slate-800" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-5">
            {/* Security card */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900 p-5">
              <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800 mb-4" />
              <div className="flex gap-2 mb-4">
                {[80, 64, 72].map((w, i) => (
                  <div key={i} className="h-7 rounded-full bg-slate-200 dark:bg-slate-800" style={{ width: w }} />
                ))}
              </div>
              {[1, 2].map((i) => (
                <div key={i} className="border-l-2 border-l-slate-200 dark:border-l-slate-700 pl-4 py-3 space-y-2 mb-2">
                  <div className="h-3 w-full rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
