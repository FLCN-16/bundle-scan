"use client";

import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="max-w-sm w-full space-y-6">

        <div className="relative size-16 mx-auto">
          <div className="size-16 rounded-2xl border border-amber-500/20 bg-amber-500/10 backdrop-blur-xl flex items-center justify-center shadow-lg shadow-amber-500/10 mx-auto">
            <AlertTriangle className="size-7 text-amber-500" />
          </div>
          <div className="absolute -inset-4 rounded-3xl bg-amber-200/10 blur-xl -z-10" />
        </div>

        <div>
          <h1 className="text-2xl-sm font-bold text-slate-900 dark:text-white tracking-[-0.02em] mb-2">
            Something went wrong
          </h1>
          <p className="text-body-sm text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
            {error.message}
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-body-sm font-semibold shadow-md shadow-indigo-600/20 transition-all"
          >
            <RotateCcw className="size-3.5" />
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-black/8 dark:border-white/8 bg-white/60 dark:bg-white/5 backdrop-blur-sm text-body-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-white/90 dark:hover:bg-white/8 transition-all"
          >
            <ArrowLeft className="size-3.5" />
            Go home
          </a>
        </div>

      </div>
    </main>
  );
}
