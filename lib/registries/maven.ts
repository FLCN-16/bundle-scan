"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { PackageMeta } from "@/lib/types";

interface MavenSearchResponse {
  response: {
    docs: Array<{
      id: string;
      g: string;
      a: string;
      latestVersion: string;
      timestamp: number;
    }>;
  };
}

interface MavenVersionsResponse {
  response: {
    docs: Array<{ v: string; timestamp: number }>;
  };
}

function parsePomDependencies(pom: string): Record<string, string> {
  const deps: Record<string, string> = {};
  const depRegex =
    /<dependency>[\s\S]*?<groupId>([\s\S]*?)<\/groupId>[\s\S]*?<artifactId>([\s\S]*?)<\/artifactId>[\s\S]*?<\/dependency>/g;
  let m;
  while ((m = depRegex.exec(pom)) !== null) {
    deps[`${m[1].trim()}:${m[2].trim()}`] = "*";
  }
  return deps;
}

function extractPomField(pom: string, tag: string): string | undefined {
  const m = pom.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`));
  return m?.[1]?.trim();
}

async function fetchMavenSearch(
  groupId: string,
  artifactId: string
): Promise<MavenSearchResponse> {
  "use cache";
  cacheTag(`maven-search:${groupId}:${artifactId}`);
  cacheLife("hours");
  const q = `g:${groupId}+AND+a:${artifactId}`;
  const url = `https://search.maven.org/solrsearch/select?q=${q}&rows=1&wt=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Maven Central error ${res.status}`);
  return res.json() as Promise<MavenSearchResponse>;
}

async function fetchMavenVersions(
  groupId: string,
  artifactId: string
): Promise<string[]> {
  "use cache";
  cacheTag(`maven-versions:${groupId}:${artifactId}`);
  cacheLife("hours");
  const q = `g:${groupId}+AND+a:${artifactId}`;
  const url = `https://search.maven.org/solrsearch/select?q=${q}&core=gav&rows=100&wt=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as MavenVersionsResponse;
  return data.response.docs
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((d) => d.v);
}

async function fetchPom(
  groupId: string,
  artifactId: string,
  version: string
): Promise<string> {
  "use cache";
  cacheTag(`maven-pom:${groupId}:${artifactId}:${version}`);
  cacheLife("weeks");
  const gPath = groupId.replace(/\./g, "/");
  const url = `https://repo1.maven.org/maven2/${gPath}/${artifactId}/${version}/${artifactId}-${version}.pom`;
  const res = await fetch(url);
  if (!res.ok) return "";
  return res.text();
}

export async function resolveMaven(
  name: string,
  version?: string
): Promise<PackageMeta> {
  "use cache";
  cacheTag(`registry:maven:${name}:${version ?? "latest"}`);
  cacheLife("hours");

  // name format: groupId/artifactId or groupId:artifactId
  const sep = name.includes("/") ? "/" : ":";
  const [groupId, artifactId] = name.split(sep);
  if (!groupId || !artifactId)
    throw new Error(`Maven artifact must be "groupId/artifactId", got: ${name}`);

  const [searchData, allVersions] = await Promise.all([
    fetchMavenSearch(groupId, artifactId),
    fetchMavenVersions(groupId, artifactId),
  ]);

  const resolvedVersion =
    version && allVersions.includes(version)
      ? version
      : searchData.response.docs[0]?.latestVersion ?? allVersions[0];

  if (!resolvedVersion) throw new Error(`No version found for ${name}`);

  const pom = await fetchPom(groupId, artifactId, resolvedVersion);
  const deps = pom ? parsePomDependencies(pom) : {};
  const description = pom
    ? (extractPomField(pom, "description") ?? `${groupId}:${artifactId}`)
    : `${groupId}:${artifactId}`;
  const license =
    (pom ? extractPomField(pom, "name") : undefined) ?? "Unknown";
  const scmUrl = pom ? extractPomField(pom, "url") : undefined;
  const jarUrl = `https://repo1.maven.org/maven2/${groupId.replace(/\./g, "/")}/${artifactId}/${resolvedVersion}/${artifactId}-${resolvedVersion}.jar`;

  const published = searchData.response.docs[0]?.timestamp;

  return {
    name: `${groupId}:${artifactId}`,
    version: resolvedVersion,
    description,
    license,
    homepage: scmUrl,
    repository: scmUrl,
    ecosystem: "Maven",
    publishedAt: published ? new Date(published).toISOString() : undefined,
    allVersions,
    dependencies: deps,
    tarballUrl: jarUrl,
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
