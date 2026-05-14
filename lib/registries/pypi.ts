"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { PackageMeta } from "@/lib/types";

interface PypiResponse {
  info: {
    name: string;
    version: string;
    summary: string;
    license?: string;
    home_page?: string;
    project_urls?: Record<string, string>;
    requires_dist?: string[];
    author?: string;
    maintainer?: string;
  };
  releases?: Record<string, Array<{ upload_time?: string }>>;
  urls: Array<{ url: string; filename: string; packagetype: string; size: number; upload_time?: string }>;
}

async function fetchPypi(name: string, version?: string): Promise<PypiResponse> {
  "use cache";
  cacheTag(`pypi-meta:${name}:${version ?? "latest"}`);
  cacheLife("hours");
  const path = version ? `/${name}/${version}/json` : `/${name}/json`;
  const res = await fetch(`https://pypi.org/pypi${path}`);
  if (!res.ok) throw new Error(`PyPI error ${res.status} for ${name}`);
  return res.json() as Promise<PypiResponse>;
}

export async function resolvePypi(
  name: string,
  version?: string
): Promise<PackageMeta> {
  "use cache";
  cacheTag(`registry:pypi:${name}:${version ?? "latest"}`);
  cacheLife("hours");

  const specificVersion = version === "latest" ? undefined : version;
  const [data, latestData] = await Promise.all([
    fetchPypi(name, specificVersion),
    specificVersion ? fetchPypi(name) : Promise.resolve(null),
  ]);
  const { info, urls } = data;
  const releases = data.releases ?? latestData?.releases;
  const allVersions = releases ? Object.keys(releases).reverse() : [info.version];
  const wheelUrl = urls.find((u) => u.filename.endsWith(".whl"))?.url;
  const distSizes = urls
    .filter((u) => u.size > 0)
    .map((u) => ({ filename: u.filename, packagetype: u.packagetype, size: u.size, url: u.url }));

  const requiresDist = info.requires_dist ?? [];
  const deps: Record<string, string> = {};
  for (const req of requiresDist) {
    if (/;\s*extra\s*==/.test(req)) continue;
    const m = req.match(/^([A-Za-z0-9_.\-]+)\s*([^;]*)/);
    if (!m) continue;
    deps[m[1]] = m[2].trim() || "*";
  }

  const repoUrl =
    info.project_urls?.["Source"] ??
    info.project_urls?.["Repository"] ??
    info.project_urls?.["Homepage"] ??
    info.home_page;

  return {
    name: info.name,
    version: info.version,
    description: info.summary,
    license: info.license ?? "Unknown",
    homepage: info.home_page,
    repository: repoUrl,
    ecosystem: "PyPI",
    publishedAt: urls[0]?.upload_time,
    allVersions,
    dependencies: deps,
    tarballUrl: wheelUrl,
    distSizes,
  };
}

export async function listPypiVersions(name: string): Promise<string[]> {
  "use cache";
  cacheTag(`pypi-versions:${name}`);
  cacheLife("hours");
  const data = await fetchPypi(name);
  return Object.keys(data.releases ?? {}).reverse();
}
