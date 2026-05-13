"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Package, FileText } from "lucide-react";
import { SearchBar } from "./SearchBar";
import { FileScan } from "./FileScan";

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
  const [draggingOver, setDraggingOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState<{ name: string; content: string } | undefined>();
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDroppedFile = useCallback(async (file: File) => {
    try {
      const result = await readFile(file);
      setDroppedFile(result);
    } catch {
      // ignore read errors — FileScan will surface parse errors
    }
  }, []);

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
    <div className="w-full space-y-4">
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
          accept=".json,.txt,.xml"
          className="sr-only"
          onChange={handleInputChange}
        />
        <div className="flex-1 h-px bg-black/6 dark:bg-white/7" />
      </div>

      {droppedFile && (
        <FileScan key={droppedFile.name + droppedFile.content.length} initialFile={droppedFile} />
      )}

      {/* Full-page drag overlay */}
      {draggingOver && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="rounded-3xl border-2 border-dashed border-indigo-400 dark:border-indigo-500 bg-indigo-500/10 dark:bg-indigo-500/15 px-8 sm:px-20 py-10 sm:py-14 flex flex-col items-center gap-4 text-center">
            <div className="size-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Package className="size-8 text-indigo-300" />
            </div>
            <p className="text-2xl font-semibold text-white">Drop to scan</p>
            <p className="text-sm text-slate-300 font-mono">package.json · requirements.txt · pom.xml</p>
          </div>
        </div>
      )}
    </div>
  );
}
