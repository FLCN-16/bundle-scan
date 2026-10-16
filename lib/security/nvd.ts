"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { Advisory, Severity } from "@/lib/types";
import { compareVersions } from "./semver";

interface CpeMatch {
  criteria: string;
  vulnerable: boolean;
  versionExact?: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

interface NvdCve {
  id: string;
  descriptions: Array<{ lang: string; value: string }>;
  published: string;
  metrics?: {
    cvssMetricV31?: Array<{ cvssData: { baseScore: number; baseSeverity: string } }>;
    cvssMetricV30?: Array<{ cvssData: { baseScore: number; baseSeverity: string } }>;
    cvssMetricV2?: Array<{ cvssData: { baseScore: number }; baseSeverity?: string }>;
  };
  references?: Array<{ url: string; tags?: string[] }>;
  configurations?: Array<{
    nodes: Array<{ cpeMatch: CpeMatch[] }>;
  }>;
}

interface NvdResponse {
  vulnerabilities?: Array<{ cve: NvdCve }>;
}

function nvdScoreToSeverity(score: number): Severity {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function getBestScore(cve: NvdCve): Severity {
  const v31 = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
  if (v31) return nvdScoreToSeverity(v31.baseScore);
  const v30 = cve.metrics?.cvssMetricV30?.[0]?.cvssData;
  if (v30) return nvdScoreToSeverity(v30.baseScore);
  const v2score = cve.metrics?.cvssMetricV2?.[0]?.cvssData?.baseScore;
  if (v2score !== undefined) return nvdScoreToSeverity(v2score);
  return "unknown";
}

function cpeVersion(criteria: string): string {
  const parts = criteria.split(":");
  return parts[5] ?? "*";
}

function packageMatchesCpe(name: string, criteria: string): boolean {
  const cpeParts = criteria.split(":");
  const cpeVendor = (cpeParts[3] ?? "").toLowerCase();
  const cpeProduct = (cpeParts[4] ?? "*").toLowerCase();

  // Wildcard product can't be narrowed — skip to avoid false positives
  if (cpeProduct === "*" || cpeProduct === "-") return false;

  // Normalize hyphens and underscores to the same separator so
  // "react-native" and "react_native" are treated as identical, but
  // "react" and "react-native" remain distinct.
  const norm = (s: string) => s.replace(/[-_]/g, "-");

  // Strip npm scope prefix: @babel/core → core
  const strippedName = name.toLowerCase().replace(/^@[^/]+\//, "");
  const normProduct = norm(cpeProduct);

  // Exact match: normalized package name == normalized CPE product
  if (norm(strippedName) === normProduct) return true;

  // Scoped package (@scope/pkg): also accept when CPE vendor matches scope
  // and CPE product matches the package name (e.g. @babel/core → vendor:babel product:core)
  if (name.startsWith("@")) {
    const scope = name.toLowerCase().slice(1, name.indexOf("/"));
    if (norm(cpeVendor) === norm(scope) && norm(strippedName) === normProduct) return true;
    // Also accept scope-pkg combined: @babel/core → babel-core
    if (norm(`${scope}-${strippedName}`) === normProduct) return true;
  }

  return false;
}

function versionMatchesCpe(version: string, match: CpeMatch): boolean {
  const cpeVer = cpeVersion(match.criteria);

  // Exact version in CPE string
  if (cpeVer !== "*" && cpeVer !== "-") {
    const result = compareVersions(version, cpeVer);
    if (result === 0 || (result === null && cpeVer === version)) return true;
  }

  // Range fields take precedence over CPE version component
  const hasRange =
    match.versionStartIncluding ||
    match.versionStartExcluding ||
    match.versionEndIncluding ||
    match.versionEndExcluding;

  if (hasRange) {
    const compare = (boundary: string) => compareVersions(version, boundary);
    if (match.versionStartIncluding) {
      const result = compare(match.versionStartIncluding);
      if (result === null || result < 0) return false;
    }
    if (match.versionStartExcluding) {
      const result = compare(match.versionStartExcluding);
      if (result === null || result <= 0) return false;
    }
    if (match.versionEndIncluding) {
      const result = compare(match.versionEndIncluding);
      if (result === null || result > 0) return false;
    }
    if (match.versionEndExcluding) {
      const result = compare(match.versionEndExcluding);
      if (result === null || result >= 0) return false;
    }
    return true;
  }

  // Wildcard version — matches if the package name matched
  if (cpeVer === "*") return true;

  return false;
}

function affectsVersion(cve: NvdCve, name: string, version: string): boolean {
  if (!cve.configurations?.length) {
    // No config data — fall back to name-only match (best-effort)
    return false;
  }

  for (const config of cve.configurations) {
    for (const node of config.nodes) {
      for (const match of node.cpeMatch) {
        if (!match.vulnerable) continue;
        if (!packageMatchesCpe(name, match.criteria)) continue;
        if (versionMatchesCpe(version, match)) return true;
      }
    }
  }
  return false;
}

export async function queryNvd(
  name: string,
  _ecosystem: string,
  version: string
): Promise<Advisory[]> {
  "use cache";
  cacheTag(`nvd:${name}:${version}`);
  cacheLife("hours");

  const apiKey = process.env.NVD_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers["apiKey"] = apiKey;

  const searchName = name.replace(/^@/, "").replace(/\//g, " ");
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(searchName)}&keywordExactMatch`;

  let data: NvdResponse;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`NVD request failed with HTTP ${res.status}`);
    data = (await res.json()) as NvdResponse;
  } catch (error) {
    throw error instanceof Error ? error : new Error("NVD request failed");
  }

  return (data.vulnerabilities ?? [])
    .map((v) => v.cve)
    .filter((cve) => affectsVersion(cve, name, version))
    .slice(0, 20)
    .map((cve) => {
      const severity = getBestScore(cve);
      const desc = cve.descriptions.find((d) => d.lang === "en")?.value ?? cve.id;
      return {
        id: cve.id,
        aliases: [],
        severity,
        summary: desc.slice(0, 300),
        details: desc,
        fixedVersions: [],
        source: "NVD" as const,
        confidence: "low" as const,
        url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
        publishedAt: cve.published,
      };
    });
}
