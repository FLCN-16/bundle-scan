"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { PackageMeta } from "@/lib/types";

interface NpmVersionData {
  name: string;
  version: string;
  description?: string;
  license?: string | { type: string };
  homepage?: string;
  repository?: { url?: string } | string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  sideEffects?: boolean | string[];
  types?: string;
  typings?: string;
  module?: string;
  exports?: unknown;
  dist: { tarball: string; unpackedSize?: number };
}

interface NpmDistTags {
  latest?: string;
  [tag: string]: string | undefined;
}

interface NpmDownloadsData {
  downloads: number;
}

function npmPath(name: string) {
  return encodeURIComponent(name).replace(/%40/g, "@").replace(/%2F/g, "/");
}

function extractLicense(license: string | { type: string } | undefined): string {
  if (!license) return "Unknown";
  if (typeof license === "string") return license;
  return license.type ?? "Unknown";
}

function extractRepoUrl(repo: { url?: string } | string | undefined): string | undefined {
  if (!repo) return undefined;
  const raw = typeof repo === "string" ? repo : repo.url ?? "";
  return raw.replace(/^git\+/, "").replace(/\.git$/, "");
}

async function fetchVersionDoc(name: string, version: string): Promise<NpmVersionData> {
  "use cache";
  cacheTag(`npm-ver:${name}:${version}`);
  cacheLife("days");
  const res = await fetch(
    `https://registry.npmjs.org/${npmPath(name)}/${encodeURIComponent(version)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`npm: ${name}@${version} not found (HTTP ${res.status})`);
  return res.json() as Promise<NpmVersionData>;
}

async function fetchDistTags(name: string): Promise<NpmDistTags> {
  "use cache";
  cacheTag(`npm-tags:${name}`);
  cacheLife("minutes");
  const res = await fetch(
    `https://registry.npmjs.org/-/package/${npmPath(name)}/dist-tags`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return {};
  return res.json() as Promise<NpmDistTags>;
}

async function fetchDownloads(name: string): Promise<number | undefined> {
  "use cache";
  cacheTag(`npm-dl:${name}`);
  cacheLife("hours");
  try {
    const res = await fetch(
      `https://api.npmjs.org/downloads/point/last-week/${npmPath(name)}`
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as NpmDownloadsData;
    return data.downloads;
  } catch {
    return undefined;
  }
}

export async function resolveNpm(
  name: string,
  version?: string
): Promise<PackageMeta> {
  "use cache";
  cacheTag(`registry:npm:${name}:${version ?? "latest"}`);
  cacheLife("hours");

  const [tags, downloads] = await Promise.all([
    fetchDistTags(name),
    fetchDownloads(name),
  ]);

  const resolvedVersion = version ?? tags.latest ?? "latest";
  const v = await fetchVersionDoc(name, resolvedVersion);

  return {
    name: v.name,
    version: v.version,
    description: v.description ?? "",
    license: extractLicense(v.license),
    homepage: v.homepage,
    repository: extractRepoUrl(v.repository),
    ecosystem: "npm",
    publishedAt: undefined,
    weeklyDownloads: downloads,
    maintainersCount: undefined,
    allVersions: [],
    dependencies: v.dependencies ?? {},
    devDependencies: v.devDependencies ?? {},
    sideEffects: v.sideEffects,
    hasTypes: !!(v.types ?? v.typings),
    hasEsm: !!(v.module ?? v.exports),
    tarballUrl: v.dist.tarball,
  };
}

export async function listNpmVersions(name: string): Promise<string[]> {
  "use cache";
  cacheTag(`npm-versions:${name}`);
  cacheLife("hours");
  // Full manifest fetch — intentionally separate from resolveNpm so the
  // package page isn't blocked by the large payload.
  const res = await fetch(
    `https://registry.npmjs.org/${npmPath(name)}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) return [];
  const data = await res.json() as { versions?: Record<string, unknown> };
  return Object.keys(data.versions ?? {}).reverse();
}
