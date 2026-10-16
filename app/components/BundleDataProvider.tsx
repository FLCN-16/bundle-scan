"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { BundleResponse } from "@/lib/types";
import { fetchWithTimeout } from "@/lib/http";

export type BundlePhase = "idle" | "installing" | "bundling" | "done";

interface BundleData {
  result: BundleResponse | null;
  loading: boolean;
  phase: BundlePhase;
  error: boolean;
}

const BundleDataContext = createContext<BundleData>({
  result: null,
  loading: true,
  phase: "idle",
  error: false,
});

export function useBundleData() {
  return useContext(BundleDataContext);
}

export function BundleDataProvider({
  name,
  version,
  enabled = true,
  children,
}: {
  name: string;
  version: string;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const [result, setResult] = useState<BundleResponse | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [phase, setPhase] = useState<BundlePhase>("idle");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetchWithTimeout("/api/bundle/npm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, version }),
          signal: controller.signal,
        }, 70_000);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            const event = JSON.parse(line.slice(6)) as
              | { type: "progress"; phase: "installing" | "bundling" }
              | { type: "result"; data: BundleResponse };
            if (event.type === "progress") {
              setPhase(event.phase);
            } else if (event.type === "result") {
              setResult(event.data);
              setPhase("done");
              setLoading(false);
            }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("[BundleDataProvider] stream error:", err);
        setError(true);
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [name, version, enabled]);

  return (
    <BundleDataContext.Provider value={{ result, loading, phase, error }}>
      {children}
    </BundleDataContext.Provider>
  );
}
