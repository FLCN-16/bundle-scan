"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileScan } from "./FileScan";
import { ArrowLeft, FileX } from "lucide-react";

export function ScanPageClient({ id }: { id: string }) {
  const router = useRouter();
  const [initialFile, setInitialFile] = useState<{ name: string; content: string } | undefined>();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const raw = sessionStorage.getItem(`bundle-scan-file-${id}`);
    if (raw) {
      try {
        const data = JSON.parse(raw) as { name: string; content: string };
        sessionStorage.removeItem(`bundle-scan-file-${id}`);
        setInitialFile(data);
      } catch {
        setExpired(true);
      }
    } else {
      setExpired(true);
    }
    setReady(true);
  }, [id]);

  if (!ready) return null;

  if (expired) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="size-14 rounded-2xl border border-black/8 dark:border-white/8 bg-white/60 dark:bg-white/5 flex items-center justify-center">
          <FileX className="size-6 text-slate-400 dark:text-slate-500" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-200">Session expired</p>
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

  return <FileScan initialFile={initialFile} />;
}
