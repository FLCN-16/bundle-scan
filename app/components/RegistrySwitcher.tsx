"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Registry } from "@/lib/types";

function NpmIcon({ active }: { active: boolean }) {
  return (
    <svg width="14" height="12" viewBox="0 0 576 512" aria-hidden="true" style={{ opacity: active ? 1 : 0.5 }}>
      <path fill="#CB3837" d="M288 288h-32v-64h32v64zm288-128v192H288v32H160v-32H0V160h576zm-416 32H32v128h64v-96h32v96h32V192zm160 0H192v160h64v-32h64V192zm224 0H352v128h64v-96h32v96h32V192z" />
    </svg>
  );
}

function PyPIIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 448 512" aria-hidden="true" style={{ opacity: active ? 1 : 0.5 }}>
      <path fill="#3776AB" d="M439.8 200.5c-7.7-30.9-22.3-54.2-53.4-54.2h-40.1v47.4c0 36.8-31.2 67.8-66.8 67.8H172.7c-29.2 0-53.4 25-53.4 54.3v101.8c0 29 25.2 46 53.4 54.3 33.8 9.9 66.3 11.7 106.8 0 26.9-7.8 53.4-23.5 53.4-54.3v-40.7H226.2v-13.6h160.2c31.1 0 42.6-21.7 53.4-54.2 11.2-33.5 10.7-65.7 0-108.6zM286.2 404c11.1 0 20.1 9.1 20.1 20.3 0 11.3-9 20.4-20.1 20.4-11 0-20.1-9.2-20.1-20.4.1-11.3 9.1-20.3 20.1-20.3z" />
      <path fill="#FFD43B" d="M167.8 248.1h106.8c29.7 0 53.4-24.5 53.4-54.3V91.9c0-29-24.4-50.7-53.4-55.6-35.8-5.9-74.8-5.6-106.8.1-45.2 8-53.4 24.7-53.4 55.6v40.7h106.9v13.6h-147c-31.1 0-58.3 18.7-66.8 54.2-9.8 40.7-10.2 66.1 0 108.6 7.6 31.6 25.7 54.2 56.8 54.2H101v-48.8c0-35.3 30.5-66.4 66.8-66.4zm-6.7-142.6c-11.1 0-20.1-9.1-20.1-20.3.1-11.3 9-20.4 20.1-20.4 11 0 20.1 9.2 20.1 20.4s-9 20.3-20.1 20.3z" />
    </svg>
  );
}

function MavenIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ opacity: active ? 1 : 0.5 }}>
      <rect width="24" height="24" rx="3.5" fill="#C71A36" />
      <path fill="white" d="M3 19V5l4.5 7L12 5l4.5 7L21 5v14h-2v-9.5l-2.5 3.9L14 9.5V19h-2V9.5L9.5 13.4 7 9.5V19H3z" />
    </svg>
  );
}

const REGISTRY_ICONS: Record<Registry, (active: boolean) => ReactNode> = {
  npm: (a) => <NpmIcon active={a} />,
  pypi: (a) => <PyPIIcon active={a} />,
  maven: (a) => <MavenIcon active={a} />,
};

const REGISTRIES: { id: Registry; label: string; placeholder: string }[] = [
  { id: "npm", label: "npm", placeholder: "e.g. react, lodash@4.17.21, @scope/pkg" },
  { id: "pypi", label: "PyPI", placeholder: "e.g. requests, urllib3==1.26.0" },
  { id: "maven", label: "Maven", placeholder: "e.g. org.apache.commons/commons-lang3" },
];

export function RegistrySwitcher({
  value,
  onChange,
}: {
  value: Registry;
  onChange: (r: Registry) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idx = REGISTRIES.findIndex((r) => r.id === value);
    const btn = buttonRefs.current[idx];
    const container = containerRef.current;
    if (!btn || !container) return;
    const btnRect = btn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setIndicator({
      left: btnRect.left - containerRect.left,
      width: btnRect.width,
    });
    setReady(true);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex rounded-xl border border-black/7 dark:border-white/8 p-[3px] bg-black/3 dark:bg-white/4 gap-0.5"
    >
      {/* Sliding indicator */}
      {ready && (
        <div
          aria-hidden="true"
          className="absolute top-[3px] bottom-[3px] rounded-(--radius-switcher-btn) bg-white dark:bg-white/10 shadow-sm shadow-black/6"
          style={{
            left: indicator.left,
            width: indicator.width,
            transition: "left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      )}

      {REGISTRIES.map((r, i) => {
        const active = value === r.id;
        return (
          <button
            key={r.id}
            ref={(el) => { buttonRefs.current[i] = el; }}
            onClick={() => onChange(r.id)}
            aria-pressed={active}
            className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-(--radius-switcher-btn) text-xs font-semibold tracking-tight transition-colors duration-150 ${
              active
                ? "text-slate-900 dark:text-slate-100"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {REGISTRY_ICONS[r.id](active)}
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

export { REGISTRIES };
