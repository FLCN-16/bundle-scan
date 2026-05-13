"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { RegistrySwitcher, REGISTRIES } from "./RegistrySwitcher";
import type { Registry } from "@/lib/types";

interface Suggestion {
  name: string;
  description?: string;
}

async function fetchSuggestions(query: string, registry: Registry): Promise<Suggestion[]> {
  if (query.length < 2) return [];
  try {
    if (registry === "npm") {
      const res = await fetch(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=7`
      );
      if (!res.ok) return [];
      const data = await res.json() as { objects: Array<{ package: { name: string; description?: string } }> };
      return data.objects.map((o) => ({ name: o.package.name, description: o.package.description }));
    }
    if (registry === "pypi") {
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`);
      if (res.ok) {
        const data = await res.json() as { info: { name: string; summary?: string } };
        return [{ name: data.info.name, description: data.info.summary }];
      }
      return [];
    }
  } catch { /* ignore */ }
  return [];
}

function parseInput(raw: string, registry: Registry): { name: string; version?: string } {
  const trimmed = raw.trim();
  if (registry === "npm") {
    const atIdx = trimmed.lastIndexOf("@");
    if (atIdx > 0) return { name: trimmed.slice(0, atIdx), version: trimmed.slice(atIdx + 1) };
  }
  if (registry === "pypi") {
    const eqIdx = trimmed.indexOf("==");
    if (eqIdx > 0) return { name: trimmed.slice(0, eqIdx), version: trimmed.slice(eqIdx + 2) };
  }
  return { name: trimmed };
}

export function SearchBar({ initialRegistry = "npm" }: { initialRegistry?: Registry }) {
  const [registry, setRegistry] = useState<Registry>(initialRegistry);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const placeholder = REGISTRIES.find((r) => r.id === registry)?.placeholder ?? "Search packages…";

  const navigate = useCallback(
    (name: string, version?: string) => {
      const encoded = encodeURIComponent(name).replace(/%40/g, "@").replace(/%2F/g, "/");
      router.push(version ? `/${registry}/${encoded}@${version}` : `/${registry}/${encoded}`);
      setOpen(false);
    },
    [registry, router]
  );

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      const { name, version } = parseInput(query, registry);
      if (name) navigate(name, version);
    },
    [query, registry, navigate]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const results = await fetchSuggestions(query, registry);
      setSuggestions(results);
      setOpen(results.length > 0);
      setFocused(0);
    }, 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, registry]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setFocused((f) => Math.min(f + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocused((f) => Math.max(f - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const s = suggestions[focused]; if (s) navigate(s.name); else handleSubmit(); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-center">
        <RegistrySwitcher
          value={registry}
          onChange={(r) => { setRegistry(r); setSuggestions([]); setOpen(false); }}
        />
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <div className="relative rounded-2xl overflow-hidden p-0.5">
          {/* Animated conic-gradient border */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="aspect-square w-[200%] flex-shrink-0 animate-border-rotate [animation-duration:6s] blur-[3px]"
              style={{
                background: "conic-gradient(transparent 52%, rgba(148,163,255,0.5) 63%, rgba(199,182,255,0.95) 73%, rgba(255,255,255,0.85) 76%, rgba(199,182,255,0.95) 79%, rgba(148,163,255,0.5) 89%, transparent 100%)",
              }}
            />
          </div>
          <div className="relative rounded-[calc(1rem-2px)] bg-white dark:bg-[#16162a]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggestions.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              aria-label="Search packages"
              aria-autocomplete="list"
              aria-expanded={open}
              className="w-full h-13 pl-11 pr-24 rounded-[calc(1rem-2px)] border-0 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-600 text-sm focus:outline-none transition-all duration-200"
            />
            <button
              type="submit"
              className="absolute right-2 top-1.75 h-9.5 px-4 rounded-(--radius-search-btn) bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-body-sm font-semibold shadow-md shadow-indigo-600/25 transition-all duration-150 hover:shadow-indigo-500/30 hover:shadow-lg"
            >
              Search
            </button>
          </div>
        </div>

        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-50 top-full mt-2 w-full rounded-2xl border border-black/7 dark:border-white/8 bg-white/95 dark:bg-surface-dark-deep/95 backdrop-blur-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <li
                key={s.name}
                role="option"
                aria-selected={i === focused}
                onMouseDown={() => navigate(s.name)}
                className={`px-4 py-3 cursor-pointer border-b border-black/4 dark:border-white/5 last:border-0 transition-colors ${
                  i === focused
                    ? "bg-indigo-50 dark:bg-indigo-500/10"
                    : "hover:bg-slate-50 dark:hover:bg-white/4"
                }`}
              >
                <div className="font-mono text-body-sm font-medium text-slate-900 dark:text-slate-100">{s.name}</div>
                {s.description && (
                  <div className="text-slate-400 dark:text-slate-500 text-xs mt-0.5 truncate">{s.description}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
}
