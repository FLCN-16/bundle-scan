"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileScan } from "./FileScan";
import type { SavedScan } from "./FileScan";
import { ArrowLeft, FileX, Clock } from "lucide-react";

type LoadState =
  | { kind: "loading" }
  | { kind: "fresh"; file: { name: string; content: string } }
  | { kind: "cached"; scan: SavedScan }
  | { kind: "expired" }
  | { kind: "notfound" };

export function ScanPageClient({ id }: { id: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    async function load() {
      // 1. Fast path: same-browser localStorage cache
      try {
        const cached = localStorage.getItem(`bundle-scan-result-${id}`);
        if (cached) {
          setState({ kind: "cached", scan: JSON.parse(cached) as SavedScan });
          return;
        }
      } catch {}

      // 2. Remote Blob store (shareable links, cross-device)
      try {
        const res = await fetch(`/api/scan/${id}`);
        if (res.ok) {
          const json = (await res.json()) as { ok: true; data: SavedScan };
          // warm the local cache so next reload is instant
          try { localStorage.setItem(`bundle-scan-result-${id}`, JSON.stringify(json.data)); } catch {}
          setState({ kind: "cached", scan: json.data });
          return;
        }
        if (res.status === 410) {
          setState({ kind: "expired" });
          return;
        }
      } catch {}

      // 3. sessionStorage — file just dropped from homepage
      const raw = sessionStorage.getItem(`bundle-scan-file-${id}`);
      if (raw) {
        try {
          const data = JSON.parse(raw) as { name: string; content: string };
          sessionStorage.removeItem(`bundle-scan-file-${id}`);
          setState({ kind: "fresh", file: data });
          return;
        } catch {}
      }

      setState({ kind: "notfound" });
    }

    load();
  }, [id]);

  if (state.kind === "loading") return null;

  if (state.kind === "expired") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="size-14 rounded-2xl border border-black/8 dark:border-white/8 bg-white/60 dark:bg-white/5 flex items-center justify-center">
          <Clock className="size-6 text-slate-400 dark:text-slate-500" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">Scan expired</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Scan results are kept for 24 hours. Drop a file on the homepage to start a new scan.
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-black/8 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to homepage
        </button>
      </div>
    );
  }

  if (state.kind === "notfound") {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="size-14 rounded-2xl border border-black/8 dark:border-white/8 bg-white/60 dark:bg-white/5 flex items-center justify-center">
          <FileX className="size-6 text-slate-400 dark:text-slate-500" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">Scan not found</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Drop a dependency file on the homepage to start a new scan.
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-black/8 dark:border-white/10 bg-white/70 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/8 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to homepage
        </button>
      </div>
    );
  }

  return (
    <FileScan
      initialFile={state.kind === "fresh" ? state.file : undefined}
      savedScan={state.kind === "cached" ? state.scan : undefined}
      scanId={id}
    />
  );
}
