import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Download, Box, Globe, GitBranch, ExternalLink } from "lucide-react";
import { resolveNpm } from "@/lib/registries/npm";
import { resolvePypi } from "@/lib/registries/pypi";
import { resolveMaven } from "@/lib/registries/maven";
import { SecurityClient } from "@/app/components/SecurityClient";
import { BundleClient } from "@/app/components/BundleClient";
import { VersionPicker } from "@/app/components/VersionPicker";
import { DependenciesClient } from "@/app/components/DependenciesClient";
import { LanguageBar } from "@/app/components/LanguageBar";
import { InstallCommand } from "@/app/components/InstallCommand";
import type { PackageMeta } from "@/lib/types";

const VALID_REGISTRIES = ["npm", "pypi", "maven"] as const;
type ValidRegistry = (typeof VALID_REGISTRIES)[number];

const ECOSYSTEM_MAP: Record<ValidRegistry, string> = {
  npm: "npm",
  pypi: "PyPI",
  maven: "Maven",
};

const REGISTRY_CHIP: Record<ValidRegistry, string> = {
  npm: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20",
  pypi: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  maven: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
};

const AVATAR_GRADIENTS = [
  ["from-indigo-500", "to-violet-600"],
  ["from-sky-500",    "to-indigo-500"],
  ["from-emerald-500","to-teal-600"],
  ["from-orange-500", "to-red-500"],
  ["from-pink-500",   "to-rose-600"],
  ["from-amber-500",  "to-orange-500"],
  ["from-teal-500",   "to-cyan-600"],
  ["from-violet-500", "to-purple-600"],
] as const;

function avatarGradient(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [from, to] = AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
  return `${from} ${to}`;
}

function avatarLetter(name: string): string {
  const base = name.startsWith("@") ? name.split("/")[1] ?? name : name;
  return (base[0] ?? "?").toUpperCase();
}

interface PageProps {
  params: Promise<{ registry: string; pkg: string[] }>;
}

function parsePkgSegments(registry: ValidRegistry, segments: string[]): { name: string; version?: string } {
  // Next.js may pass @ as %40 in dynamic segments — decode first.
  const raw = segments.map((s) => { try { return decodeURIComponent(s); } catch { return s; } }).join("/");
  if (registry === "npm") {
    const atIdx = raw.lastIndexOf("@");
    if (atIdx > 0) return { name: raw.slice(0, atIdx), version: raw.slice(atIdx + 1) };
    return { name: raw };
  }
  if (registry === "pypi") {
    const eqIdx = raw.indexOf("==");
    if (eqIdx > 0) return { name: raw.slice(0, eqIdx), version: raw.slice(eqIdx + 2) };
    const atIdx = raw.lastIndexOf("@");
    if (atIdx > 0) return { name: raw.slice(0, atIdx), version: raw.slice(atIdx + 1) };
    return { name: raw };
  }
  const atIdx = raw.lastIndexOf("@");
  if (atIdx > 0) return { name: raw.slice(0, atIdx), version: raw.slice(atIdx + 1) };
  return { name: raw };
}

async function resolveMeta(registry: ValidRegistry, name: string, version?: string): Promise<PackageMeta> {
  if (registry === "npm") return resolveNpm(name, version);
  if (registry === "pypi") return resolvePypi(name, version);
  return resolveMaven(name, version);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { registry, pkg } = await params;
  const name = pkg.join("/").split("@")[0];
  return {
    title: `${name} — Bundle Scan`,
    description: `Bundle size and security analysis for ${name} on ${registry}`,
  };
}

/* ── Shared card shell ── */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl border border-black/7 dark:border-white/7 bg-white/80 dark:bg-white/4 backdrop-blur-xl shadow-sm shadow-black/4 dark:shadow-black/20 overflow-hidden ${className}`}>
      {/* rim highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/15 to-transparent pointer-events-none" />
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-label font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 select-none">
      {children}
    </p>
  );
}

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-label font-semibold tracking-tight ${className}`}>
      {children}
    </span>
  );
}

function formatBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(2)} MB`;
  if (b >= 1_024) return `${(b / 1_024).toFixed(1)} kB`;
  return `${b} B`;
}

const DIST_LABEL: Record<string, string> = {
  bdist_wheel: "Wheel",
  sdist: "Source",
  bdist_egg: "Egg",
};

function PypiDistSizes({ distSizes }: { distSizes: NonNullable<PackageMeta["distSizes"]> }) {
  const wheel = distSizes.find((d) => d.packagetype === "bdist_wheel");
  const sdist = distSizes.find((d) => d.packagetype === "sdist");
  const others = distSizes.filter((d) => d.packagetype !== "bdist_wheel" && d.packagetype !== "sdist");
  const display = [...(wheel ? [wheel] : []), ...(sdist ? [sdist] : []), ...others];

  return (
    <div className="space-y-3">
      {display.map((d) => (
        <div key={d.filename}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {DIST_LABEL[d.packagetype] ?? d.packagetype}
            </span>
            <a
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="text-label text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Download ↗
            </a>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl-sm font-bold text-slate-900 dark:text-white leading-none tabular-nums">
              {formatBytes(d.size).split(" ")[0]}
            </span>
            <span className="text-body-sm text-slate-400 dark:text-slate-500">
              {formatBytes(d.size).split(" ")[1]}
            </span>
          </div>
          <p className="text-label text-slate-400 dark:text-slate-500 font-mono mt-0.5 truncate" title={d.filename}>
            {d.filename}
          </p>
        </div>
      ))}
    </div>
  );
}

function compactCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function QuickFacts({ meta }: { meta: PackageMeta }) {
  const facts: Array<{ label: string; value: string }> = [];
  if (meta.publishedAt)
    facts.push({ label: "Published", value: new Date(meta.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) });
  if (meta.weeklyDownloads !== undefined)
    facts.push({ label: "Weekly downloads", value: compactCount(meta.weeklyDownloads) });
  facts.push({ label: "Dependencies", value: String(Object.keys(meta.dependencies).length) });
  if (meta.ecosystem === "npm") {
    if (meta.hasTypes !== undefined)
      facts.push({ label: "TypeScript", value: meta.hasTypes ? "Included" : "None" });
    if (meta.hasEsm !== undefined)
      facts.push({ label: "ESM", value: meta.hasEsm ? "Yes" : "No (CJS only)" });
    if (meta.sideEffects !== undefined)
      facts.push({ label: "Tree-shakeable", value: meta.sideEffects === false ? "Yes" : "No" });
  }
  if (!facts.length) return null;
  return (
    <Card className="p-5">
      <SectionLabel>Package info</SectionLabel>
      <dl className="space-y-2.5">
        {facts.map((f) => (
          <div key={f.label} className="flex justify-between items-center gap-4">
            <dt className="text-body-sm text-slate-500 dark:text-slate-400 shrink-0">{f.label}</dt>
            <dd className="text-body-sm font-medium text-slate-900 dark:text-slate-100 text-right tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}


export default async function PackagePage({ params }: PageProps) {
  const { registry, pkg } = await params;
  if (!VALID_REGISTRIES.includes(registry as ValidRegistry)) notFound();
  const validRegistry = registry as ValidRegistry;
  const { name, version } = parsePkgSegments(validRegistry, pkg);

  let meta: PackageMeta;
  try {
    meta = await resolveMeta(validRegistry, name, version);
  } catch (err) {
    console.error(`[PackagePage] resolveMeta failed for ${validRegistry}/${name}@${version}:`, err);
    notFound();
  }

  const ecosystem = ECOSYSTEM_MAP[validRegistry];

  return (
    <main className="flex-1">

      {/* Package header */}
      <div className="relative border-b border-black/6 dark:border-white/6 bg-white/60 dark:bg-surface-dark/60 backdrop-blur-2xl overflow-hidden">
        {/* Top accent line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 dark:via-indigo-400/40 to-transparent" />
        {/* Ambient glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-50 rounded-full bg-indigo-400/6 dark:bg-indigo-500/8 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-6 sm:pt-6 sm:pb-7">

<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 sm:gap-8">

            {/* Left — avatar + all info */}
            <div className="flex gap-4 sm:gap-5 min-w-0 flex-1">

              {/* Package avatar */}
              <div className={`size-14 sm:size-16 rounded-2xl bg-gradient-to-br ${avatarGradient(meta.name)} flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/10 dark:shadow-black/30 ring-1 ring-white/20`}>
                <span className="text-white text-xl sm:text-2xl font-bold select-none drop-shadow-sm">
                  {avatarLetter(meta.name)}
                </span>
              </div>

              {/* Name, chips, description, stats */}
              <div className="min-w-0 flex-1">

                {/* Name + chips */}
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <h1 className="text-package sm:text-3xl font-bold text-slate-900 dark:text-white tracking-[-0.025em] leading-none">
                    {meta.name}
                  </h1>
                  <Chip className={REGISTRY_CHIP[validRegistry]}>{meta.ecosystem}</Chip>
                  {meta.license && meta.license !== "Unknown" && (
                    <Chip className="bg-slate-100 dark:bg-white/6 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/8">
                      {meta.license}
                    </Chip>
                  )}
                </div>

                {/* Version */}
                <p className="text-body-sm text-slate-400 dark:text-slate-500 font-mono mb-3">
                  v{meta.version}
                </p>

                {/* Description */}
                {meta.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl mb-4">
                    {meta.description}
                  </p>
                )}

                {/* Stats + links row */}
                <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
                  {meta.weeklyDownloads !== undefined && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/7 rounded-lg px-2.5 py-1">
                      <Download className="size-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{compactCount(meta.weeklyDownloads)}</span>
                      <span className="text-slate-400 dark:text-slate-500">/ week</span>
                    </span>
                  )}
                  {Object.keys(meta.dependencies).length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/7 rounded-lg px-2.5 py-1">
                      <Box className="size-3 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{Object.keys(meta.dependencies).length}</span>
                      <span className="text-slate-400 dark:text-slate-500">dep{Object.keys(meta.dependencies).length !== 1 ? "s" : ""}</span>
                    </span>
                  )}

                  {(meta.homepage || meta.repository) && (
                    <span className="w-px h-4 bg-slate-200 dark:bg-white/8 mx-1 self-center" />
                  )}

                  {meta.homepage && (
                    <a
                      href={meta.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/8 border border-slate-200 dark:border-white/7 hover:border-indigo-300 dark:hover:border-indigo-500/20 rounded-lg px-2.5 py-1 transition-all"
                    >
                      <Globe className="size-3 flex-shrink-0" />
                      Homepage
                      <ExternalLink className="size-2.5 opacity-50 flex-shrink-0" />
                    </a>
                  )}
                  {meta.repository && meta.repository !== meta.homepage && (
                    <a
                      href={meta.repository}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/8 border border-slate-200 dark:border-white/7 hover:border-indigo-300 dark:hover:border-indigo-500/20 rounded-lg px-2.5 py-1 transition-all"
                    >
                      <GitBranch className="size-3 flex-shrink-0" />
                      Repository
                      <ExternalLink className="size-2.5 opacity-50 flex-shrink-0" />
                    </a>
                  )}
                </div>

              </div>
            </div>

            {/* Right — version picker */}
            <div className="shrink-0 sm:pt-1">
              <VersionPicker
                registry={validRegistry}
                name={meta.name}
                currentVersion={meta.version}
                allVersions={meta.allVersions}
              />
            </div>

          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Main — Security */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5">
              <SectionLabel>Security — v{meta.version}</SectionLabel>
              <SecurityClient name={meta.name} ecosystem={ecosystem} version={meta.version} />
            </Card>
            {Object.keys(meta.dependencies).length > 0 && (
              <Card className="p-5">
                <DependenciesClient
                  dependencies={meta.dependencies}
                  registry={validRegistry}
                  ecosystem={ecosystem}
                />
              </Card>
            )}
          </div>

          {/* Sidebar — Bundle + Facts */}
          <div className="space-y-4">
            <Card className="p-5">
              <SectionLabel>Install</SectionLabel>
              <InstallCommand registry={validRegistry} name={meta.name} version={meta.version} />
            </Card>
            <Card className="p-5">
              <SectionLabel>
                {validRegistry === "npm" ? "Bundle size" : "Distribution size"}
              </SectionLabel>
              {validRegistry === "npm" ? (
                <BundleClient name={meta.name} version={meta.version} />
              ) : validRegistry === "pypi" && meta.distSizes?.length ? (
                <PypiDistSizes distSizes={meta.distSizes} />
              ) : (
                <p className="text-body-sm text-slate-400 py-2">
                  Bundle analysis is only available for npm packages.
                  {meta.tarballUrl && (
                    <> <a href={meta.tarballUrl} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                      Download jar ↗
                    </a></>
                  )}
                </p>
              )}
            </Card>
            {meta.repository?.includes("github.com") && (
              <Card className="p-5">
                <SectionLabel>Languages</SectionLabel>
                <LanguageBar repoUrl={meta.repository} />
              </Card>
            )}
            <QuickFacts meta={meta} />
          </div>

        </div>
      </div>

    </main>
  );
}
