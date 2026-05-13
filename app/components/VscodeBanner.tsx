"use client";

import { useEffect, useState } from "react";
import { X, ShieldCheck } from "lucide-react";

const STORAGE_KEY = "flcn-sec-banner-dismissed";
const INSTALL_URL = "vscode:extension/FLCN-16.flcn-sec";

export function VscodeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="relative z-30 border-b border-white/12 dark:border-white/6 bg-white/40 dark:bg-white/[0.035] backdrop-blur-3xl">
      {/* Top rim */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/70 dark:via-indigo-400/35 to-transparent pointer-events-none" />
      {/* Colour wash */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.06] via-violet-500/[0.05] to-indigo-500/[0.06] dark:from-indigo-500/[0.09] dark:via-violet-500/[0.07] dark:to-indigo-500/[0.09] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-3">

        {/* Shield icon */}
        <div className="flex-shrink-0 size-7 rounded-lg bg-indigo-500/12 dark:bg-indigo-400/12 border border-indigo-400/20 dark:border-indigo-400/15 flex items-center justify-center">
          <ShieldCheck className="size-4 text-indigo-600 dark:text-indigo-400" strokeWidth={2} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-xs font-semibold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
            FLCN Security
          </span>
          <span className="inline-flex items-center px-1.5 py-px rounded text-[10px] font-medium bg-[#007ACC]/10 dark:bg-[#007ACC]/15 text-[#007ACC] dark:text-[#4EC9B0] border border-[#007ACC]/15 dark:border-[#007ACC]/20 leading-none whitespace-nowrap">
            VS Code
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            Real-time credential &amp; vulnerability guard — stops secrets leaking to AI tools.
          </span>
        </div>

        {/* CTA + dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href={INSTALL_URL}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold
              text-indigo-700 dark:text-indigo-300
              bg-indigo-500/10 dark:bg-indigo-400/10
              border border-indigo-400/25 dark:border-indigo-400/18
              hover:bg-indigo-500/16 dark:hover:bg-indigo-400/16
              hover:border-indigo-400/40
              active:scale-[0.97]
              transition-all duration-150
              shadow-sm shadow-indigo-500/5 dark:shadow-indigo-500/10
              backdrop-blur-sm whitespace-nowrap"
          >
            Install free
          </a>
          <button
            onClick={dismiss}
            aria-label="Dismiss banner"
            className="p-1.5 rounded-lg
              text-slate-400 dark:text-slate-500
              hover:text-slate-600 dark:hover:text-slate-300
              hover:bg-black/[0.05] dark:hover:bg-white/[0.07]
              active:scale-95
              transition-all duration-150"
          >
            <X className="size-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
