import { Hexagon, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import { HomeHero } from "./components/HomeHero";

function RegistryIcon({ registry }: { registry: string }) {
  if (registry === "npm") {
    return (
      <svg width="15" height="13" viewBox="0 0 576 512" fill="#CB3837" aria-hidden="true">
        <path d="M288 288h-32v-64h32v64zm288-128v192H288v32H160v-32H0V160h576zm-416 32H32v128h64v-96h32v96h32V192zm160 0H192v160h64v-32h64V192zm224 0H352v128h64v-96h32v96h32V192z" />
      </svg>
    );
  }
  if (registry === "PyPI") {
    return (
      <svg width="13" height="13" viewBox="0 0 448 512" aria-hidden="true">
        <path fill="#3776AB" d="M439.8 200.5c-7.7-30.9-22.3-54.2-53.4-54.2h-40.1v47.4c0 36.8-31.2 67.8-66.8 67.8H172.7c-29.2 0-53.4 25-53.4 54.3v101.8c0 29 25.2 46 53.4 54.3 33.8 9.9 66.3 11.7 106.8 0 26.9-7.8 53.4-23.5 53.4-54.3v-40.7H226.2v-13.6h160.2c31.1 0 42.6-21.7 53.4-54.2 11.2-33.5 10.7-65.7 0-108.6zM286.2 404c11.1 0 20.1 9.1 20.1 20.3 0 11.3-9 20.4-20.1 20.4-11 0-20.1-9.2-20.1-20.4.1-11.3 9.1-20.3 20.1-20.3z" />
        <path fill="#FFD43B" d="M167.8 248.1h106.8c29.7 0 53.4-24.5 53.4-54.3V91.9c0-29-24.4-50.7-53.4-55.6-35.8-5.9-74.8-5.6-106.8.1-45.2 8-53.4 24.7-53.4 55.6v40.7h106.9v13.6h-147c-31.1 0-58.3 18.7-66.8 54.2-9.8 40.7-10.2 66.1 0 108.6 7.6 31.6 25.7 54.2 56.8 54.2H101v-48.8c0-35.3 30.5-66.4 66.8-66.4zm-6.7-142.6c-11.1 0-20.1-9.1-20.1-20.3.1-11.3 9-20.4 20.1-20.4 11 0 20.1 9.2 20.1 20.4s-9 20.3-20.1 20.3z" />
      </svg>
    );
  }
  if (registry === "Maven") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="3.5" fill="#C71A36" />
        <path fill="white" d="M3 19V5l4.5 7L12 5l4.5 7L21 5v14h-2v-9.5l-2.5 3.9L14 9.5V19h-2V9.5L9.5 13.4 7 9.5V19H3z" />
      </svg>
    );
  }
  return null;
}

const POPULAR: Record<string, Array<{ label: string; href: string }>> = {
  npm: [
    { label: "react", href: "/npm/react" },
    { label: "lodash", href: "/npm/lodash" },
    { label: "axios", href: "/npm/axios" },
    { label: "express", href: "/npm/express" },
    { label: "next", href: "/npm/next" },
    { label: "@radix-ui/react-dialog", href: "/npm/@radix-ui/react-dialog" },
  ],
  PyPI: [
    { label: "requests", href: "/pypi/requests" },
    { label: "numpy", href: "/pypi/numpy" },
    { label: "fastapi", href: "/pypi/fastapi" },
    { label: "django", href: "/pypi/django" },
  ],
  Maven: [
    { label: "commons-lang3", href: "/maven/org.apache.commons/commons-lang3" },
    { label: "guava", href: "/maven/com.google.guava/guava" },
    { label: "spring-core", href: "/maven/org.springframework/spring-core" },
  ],
};

const FEATURES = [
  {
    icon: Hexagon,
    title: "Bundle Size",
    desc: "Minified + gzip size computed with esbuild, with per-dependency composition breakdown.",
    accent: "bg-indigo-500/10 dark:bg-indigo-500/10 border-indigo-500/15 dark:border-indigo-500/15",
    iconColor: "text-indigo-500 dark:text-indigo-400",
  },
  {
    icon: ShieldCheck,
    title: "Security Scanning",
    desc: "Version-specific CVE lookup across OSV.dev, GitHub Advisory DB, and NVD.",
    accent: "bg-violet-500/10 dark:bg-violet-500/10 border-violet-500/15 dark:border-violet-500/15",
    iconColor: "text-violet-500 dark:text-violet-400",
  },
  {
    icon: Zap,
    title: "Fast & Cached",
    desc: "Results cached per version. Page loads instantly — analysis streams in client-side.",
    accent: "bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/15 dark:border-emerald-500/15",
    iconColor: "text-emerald-500 dark:text-emerald-400",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col">

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-24 sm:py-32">
        <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center gap-7">

          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-black/7 dark:border-white/8 bg-white/70 dark:bg-white/5 backdrop-blur-sm text-label font-medium text-slate-500 dark:text-slate-400 shadow-sm select-none">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            npm · PyPI · Maven · CVE scanning
          </div>

          {/* Headline */}
          <div className="space-y-0.5">
            <h1 className="text-hero sm:text-hero-lg font-bold tracking-[-0.03em] text-slate-900 dark:text-white leading-hero">
              The cost of your
            </h1>
            <h1 className="text-hero sm:text-hero-lg font-bold tracking-[-0.03em] leading-hero bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500 bg-clip-text text-transparent">
              dependencies,
            </h1>
            <h1 className="text-hero sm:text-hero-lg font-bold tracking-[-0.03em] text-slate-900 dark:text-white leading-hero">
              clearly.
            </h1>
          </div>

          {/* Subtitle */}
          <p className="text-base text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
            Bundle size, security vulnerabilities, and composition — for any package, any version.
          </p>

          {/* Search */}
          <div className="w-full">
            <HomeHero />
          </div>

        </div>
      </section>

      {/* Feature strip */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-14 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-black/7 dark:border-white/8 bg-white/70 dark:bg-white/4 backdrop-blur-xl p-6 hover:bg-white/90 dark:hover:bg-white/6 hover:border-black/10 dark:hover:border-white/12 hover:shadow-lg hover:shadow-black/5 dark:hover:shadow-black/20 transition-all duration-200 overflow-hidden"
            >
              {/* subtle gradient glow in corner */}
              <div className={`absolute -top-6 -right-6 size-24 rounded-full blur-2xl opacity-30 group-hover:opacity-50 transition-opacity ${f.accent}`} />
              <div className={`relative size-10 rounded-xl border flex items-center justify-center mb-5 shadow-sm ${f.accent}`}>
                <f.icon className={`size-4.5 ${f.iconColor}`} />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 tracking-tight">{f.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Popular packages */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-14 w-full">
        <p className="text-label font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-5">Popular packages</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(POPULAR).map(([registry, pkgs]) => (
            <div
              key={registry}
              className="rounded-2xl border border-black/7 dark:border-white/7 bg-white/60 dark:bg-white/3 backdrop-blur-xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-black/5 dark:border-white/5 flex items-center gap-2">
                <RegistryIcon registry={registry} />
                <span className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {registry}
                </span>
              </div>
              <ul className="px-2 py-2">
                {pkgs.map((p) => (
                  <li key={p.label}>
                    <a
                      href={p.href}
                      className="flex items-center justify-between group px-2 py-2 rounded-xl hover:bg-black/3 dark:hover:bg-white/4 transition-colors"
                    >
                      <span className="font-mono text-body-sm text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {p.label}
                      </span>
                      <ArrowRight className="size-3 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}
