import { PackageX, ArrowLeft } from "lucide-react";
import { SearchBar } from "./components/SearchBar";

export default function NotFound() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="max-w-sm w-full space-y-6">

        <div className="relative size-16 mx-auto">
          <div className="size-16 rounded-2xl border border-black/7 dark:border-white/8 bg-white/70 dark:bg-white/5 backdrop-blur-xl flex items-center justify-center shadow-lg shadow-black/5 mx-auto">
            <PackageX className="size-7 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="absolute -inset-4 rounded-3xl bg-slate-200/20 dark:bg-white/2 blur-xl -z-10" />
        </div>

        <div>
          <h1 className="text-2xl-sm font-bold text-slate-900 dark:text-white tracking-[-0.02em] mb-2">
            Package not found
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            This package or version doesn&apos;t exist in the registry. Check the spelling and try again.
          </p>
        </div>

        <div className="w-full">
          <SearchBar />
        </div>

        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-body-sm text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back home
        </a>

      </div>
    </main>
  );
}
