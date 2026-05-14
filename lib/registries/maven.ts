"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { PackageMeta } from "@/lib/types";

interface MavenSearchDoc {
  g: string;
  a: string;
  latestVersion: string;
  timestamp: number;
  versionCount?: number;
  ec?: string[];
}

interface MavenSearchResponse {
  response: { docs: MavenSearchDoc[] };
}

interface MavenVersionsResponse {
  response: { docs: Array<{ v: string; timestamp: number }> };
}

// ── POM helpers ────────────────────────────────────────────────────────────────

function pomField(pom: string, tag: string): string | undefined {
  const m = pom.match(new RegExp(`<${tag}>([^<]+)<\\/${tag}>`));
  return m?.[1]?.trim();
}

function pomBlock(pom: string, tag: string): string | undefined {
  const m = pom.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m?.[1];
}

function parseLicense(pom: string): string {
  const block = pomBlock(pom, "licenses");
  if (!block) return "Unknown";
  const names = [...block.matchAll(/<name>([^<]+)<\/name>/g)].map((m) => m[1].trim());
  return names.join(", ") || "Unknown";
}

function parseScmUrl(pom: string): string | undefined {
  const block = pomBlock(pom, "scm");
  if (!block) return undefined;
  const url = pomField(block, "url");
  if (url) return url;
  // fall back to connection: scm:git:https://github.com/... → https://github.com/...
  const conn = pomField(block, "connection") ?? pomField(block, "developerConnection");
  return conn?.replace(/^scm:[^:]+:/, "");
}

function parseOrg(pom: string): string | undefined {
  const block = pomBlock(pom, "organization");
  return block ? pomField(block, "name") : undefined;
}

function parseDeveloperCount(pom: string): number {
  return (pom.match(/<developer>/g) ?? []).length;
}

function parseInceptionYear(pom: string): string | undefined {
  return pomField(pom, "inceptionYear");
}

function parsePomDependencies(pom: string): Record<string, string> {
  const deps: Record<string, string> = {};
  // Only the direct <dependencies> block (not <dependencyManagement>)
  const depsBlock = pom.match(/<dependencies>([\s\S]*?)<\/dependencies>/)?.[1] ?? "";
  const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
  let m;
  while ((m = depRegex.exec(depsBlock)) !== null) {
    const block = m[1];
    const scope = block.match(/<scope>([^<]+)<\/scope>/)?.[1]?.trim();
    if (scope === "test" || scope === "provided" || scope === "system") continue;
    const g = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1]?.trim();
    const a = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1]?.trim();
    const v = block.match(/<version>([^<]+)<\/version>/)?.[1]?.trim();
    if (g && a) deps[`${g}:${a}`] = v ?? "*";
  }
  return deps;
}

// ── Network helpers ────────────────────────────────────────────────────────────

async function fetchMavenSearch(groupId: string, artifactId: string): Promise<MavenSearchResponse> {
  "use cache";
  cacheTag(`maven-search:${groupId}:${artifactId}`);
  cacheLife("hours");
  const q = `g:${groupId}+AND+a:${artifactId}`;
  const res = await fetch(`https://search.maven.org/solrsearch/select?q=${q}&rows=1&wt=json`);
  if (!res.ok) throw new Error(`Maven Central error ${res.status}`);
  return res.json() as Promise<MavenSearchResponse>;
}

async function fetchMavenVersions(groupId: string, artifactId: string): Promise<string[]> {
  "use cache";
  cacheTag(`maven-versions:${groupId}:${artifactId}`);
  cacheLife("hours");
  const q = `g:${groupId}+AND+a:${artifactId}`;
  const res = await fetch(
    `https://search.maven.org/solrsearch/select?q=${q}&core=gav&rows=200&wt=json`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as MavenVersionsResponse;
  return data.response.docs.sort((a, b) => b.timestamp - a.timestamp).map((d) => d.v);
}

async function fetchPom(groupId: string, artifactId: string, version: string): Promise<string> {
  "use cache";
  cacheTag(`maven-pom:${groupId}:${artifactId}:${version}`);
  cacheLife("weeks");
  const gPath = groupId.replace(/\./g, "/");
  const url = `https://repo1.maven.org/maven2/${gPath}/${artifactId}/${version}/${artifactId}-${version}.pom`;
  const res = await fetch(url);
  if (!res.ok) return "";
  return res.text();
}

async function fetchJarSize(url: string): Promise<number | undefined> {
  "use cache";
  cacheTag(`maven-jar-size:${url}`);
  cacheLife("weeks");
  try {
    const res = await fetch(url, { method: "HEAD" });
    const len = res.headers.get("content-length");
    return len ? parseInt(len, 10) : undefined;
  } catch {
    return undefined;
  }
}

function mavenBase(groupId: string, artifactId: string, version: string): string {
  return `https://repo1.maven.org/maven2/${groupId.replace(/\./g, "/")}/${artifactId}/${version}/${artifactId}-${version}`;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function resolveMaven(name: string, version?: string): Promise<PackageMeta> {
  "use cache";
  cacheTag(`registry:maven:${name}:${version ?? "latest"}`);
  cacheLife("hours");

  const sep = name.includes("/") ? "/" : ":";
  const [groupId, artifactId] = name.split(sep);
  if (!groupId || !artifactId)
    throw new Error(`Maven artifact must be "groupId/artifactId", got: ${name}`);

  const [searchData, allVersions] = await Promise.all([
    fetchMavenSearch(groupId, artifactId),
    fetchMavenVersions(groupId, artifactId),
  ]);

  const doc = searchData.response.docs[0];
  const resolvedVersion =
    version && allVersions.includes(version) ? version : doc?.latestVersion ?? allVersions[0];

  if (!resolvedVersion) throw new Error(`No version found for ${name}`);

  const pom = await fetchPom(groupId, artifactId, resolvedVersion);
  const base = mavenBase(groupId, artifactId, resolvedVersion);

  // Discover which classifiers exist from the search `ec` field, then HEAD in parallel
  const ec = doc?.ec ?? [];
  const jarVariants: Array<{ suffix: string; label: string; packagetype: string }> = [
    { suffix: ".jar",          label: `${artifactId}-${resolvedVersion}.jar`,          packagetype: "jar" },
    { suffix: "-sources.jar",  label: `${artifactId}-${resolvedVersion}-sources.jar`,  packagetype: "sources" },
    { suffix: "-javadoc.jar",  label: `${artifactId}-${resolvedVersion}-javadoc.jar`,  packagetype: "javadoc" },
  ].filter(({ suffix }) => ec.length === 0 || ec.includes(suffix));

  const sizes = await Promise.all(
    jarVariants.map(({ suffix }) => fetchJarSize(`${base}${suffix}`))
  );

  const distSizes = jarVariants
    .map(({ suffix, label, packagetype }, i) =>
      sizes[i] != null
        ? { filename: label, packagetype, size: sizes[i]!, url: `${base}${suffix}` }
        : null
    )
    .filter(Boolean) as PackageMeta["distSizes"];

  const license = pom ? parseLicense(pom) : "Unknown";
  const description = (pom ? pomField(pom, "description") : undefined) ?? `${groupId}:${artifactId}`;
  const homepage = pom ? pomField(pom, "url") : undefined;
  const scmUrl = pom ? parseScmUrl(pom) : undefined;
  const repository = scmUrl ?? homepage;
  const org = pom ? parseOrg(pom) : undefined;
  const devCount = pom ? parseDeveloperCount(pom) : 0;
  const inceptionYear = pom ? parseInceptionYear(pom) : undefined;
  const deps = pom ? parsePomDependencies(pom) : {};

  const published = doc?.timestamp;

  return {
    name: `${groupId}:${artifactId}`,
    version: resolvedVersion,
    description: [org ? `${org} — ` : "", description, inceptionYear ? ` (since ${inceptionYear})` : ""].join(""),
    license,
    homepage,
    repository,
    ecosystem: "Maven",
    publishedAt: published ? new Date(published).toISOString() : undefined,
    allVersions,
    dependencies: deps,
    tarballUrl: `${base}.jar`,
    distSizes: distSizes?.length ? distSizes : undefined,
    ...(devCount > 0 ? { maintainersCount: devCount } : {}),
  };
}

export async function listMavenVersions(name: string): Promise<string[]> {
  "use cache";
  cacheTag(`maven-versions-list:${name}`);
  cacheLife("hours");
  const sep = name.includes("/") ? "/" : ":";
  const [groupId, artifactId] = name.split(sep);
  if (!groupId || !artifactId) return [];
  return fetchMavenVersions(groupId, artifactId);
}
