"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Package, FileText, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { SearchBar } from "./SearchBar";
import { detectAndParse } from "@/lib/parsers";

function readFile(file: File): Promise<{ name: string; content: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === "string") resolve({ name: file.name, content });
      else reject(new Error("Failed to read file"));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

export function HomeHero() {
  const router = useRouter();
  const [draggingOver, setDraggingOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDroppedFile = useCallback(async (file: File) => {
    setFileError(null);
    let result: { name: string; content: string };
    try {
      result = await readFile(file);
    } catch {
      setFileError("Failed to read file.");
      return;
    }
    try {
      const packages = detectAndParse(result.name, result.content);
      if (!packages.length) {
        setFileError("No packages found in this file.");
        return;
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Invalid file.");
      return;
    }
    const id = crypto.randomUUID();
    sessionStorage.setItem(`bundle-scan-file-${id}`, JSON.stringify(result));
    router.push(`/scan/${id}`);
  }, [router]);

  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      dragCounter.current++;
      if (e.dataTransfer?.types.includes("Files")) setDraggingOver(true);
    };
    const onDragLeave = () => {
      dragCounter.current--;
      if (dragCounter.current <= 0) { dragCounter.current = 0; setDraggingOver(false); }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDraggingOver(false);
      const file = e.dataTransfer?.files[0];
      if (file) handleDroppedFile(file);
    };

    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("drop", onDrop);
    };
  }, [handleDroppedFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleDroppedFile(file);
    // reset so the same file can be re-selected
    e.target.value = "";
  }, [handleDroppedFile]);

  return (
    <div className="w-full space-y-3">
      <SearchBar />

      <div className="flex items-center gap-3 pt-0.5">
        <div className="flex-1 h-px bg-black/6 dark:bg-white/7" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
        >
          <FileText className="size-3.5" />
          drop a dependency file to scan
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.txt,.xml,.toml"
          className="sr-only"
          onChange={handleInputChange}
        />
        <div className="flex-1 h-px bg-black/6 dark:bg-white/7" />
      </div>

      {fileError && (
        <div className="rounded-xl border border-red-500/15 bg-red-500/8 px-4 py-3 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="size-3.5 flex-shrink-0" />
          {fileError}
        </div>
      )}

      {/* Full-page drag overlay */}
      {draggingOver && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="rounded-3xl border border-white/20 ring-2 ring-indigo-400/60 dark:ring-indigo-400/50 bg-white/8 dark:bg-white/6 backdrop-blur-xl shadow-2xl shadow-indigo-500/20 px-8 sm:px-20 py-10 sm:py-14 flex flex-col items-center gap-4 text-center">
            <div className="size-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Package className="size-8 text-indigo-300" />
            </div>
            <p className="text-2xl font-semibold text-white">Drop to scan</p>
            <p className="text-sm text-slate-300 font-mono">package.json · requirements.txt · pyproject.toml · pom.xml</p>
          </div>
        </div>
      )}
    </div>
  );
}
