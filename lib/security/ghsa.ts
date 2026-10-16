"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { Advisory, Severity } from "@/lib/types";
import { versionInRange } from "./semver";
import { fetchWithRetry } from "../http";

interface GhsaEdge {
  node: {
    advisory: {
      ghsaId: string;
      summary: string;
      description?: string;
      severity: string;
      publishedAt: string;
      references: Array<{ url: string }>;
    };
    firstPatchedVersion?: { identifier: string };
    vulnerableVersionRange: string;
  };
}

interface GhsaResponse {
  errors?: Array<{ message?: string }>;
  data?: {
    securityVulnerabilities?: {
      edges?: GhsaEdge[];
    };
  };
}

const ECOSYSTEM_MAP: Record<string, string> = {
  npm: "NPM",
  pypi: "PIP",
  maven: "MAVEN",
};

function ghsaEcosystem(ecosystem: string): string | undefined {
  return ECOSYSTEM_MAP[ecosystem.toLowerCase()];
}

function ghsaSeverityToSeverity(s: string): Severity {
  const lower = s.toLowerCase();
  if (lower === "critical") return "critical";
  if (lower === "high") return "high";
  if (lower === "moderate" || lower === "medium") return "medium";
  if (lower === "low") return "low";
  return "unknown";
}

export async function queryGhsa(
  name: string,
  ecosystem: string,
  version: string
): Promise<Advisory[]> {
  "use cache";
  cacheTag(`ghsa:${ecosystem}:${name}:${version}`);
  cacheLife("hours");

  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured");

  const ghEcosystem = ghsaEcosystem(ecosystem);
  if (!ghEcosystem) throw new Error(`GHSA does not support ecosystem: ${ecosystem}`);

  const query = `
    query($ecosystem: SecurityAdvisoryEcosystem!, $package: String!) {
      securityVulnerabilities(ecosystem: $ecosystem, package: $package, first: 100) {
        edges {
          node {
            advisory {
              ghsaId
              summary
              description
              severity
              publishedAt
              references { url }
            }
            firstPatchedVersion { identifier }
            vulnerableVersionRange
          }
        }
      }
    }
  `;

  let data: GhsaResponse;
  try {
    const res = await fetchWithRetry("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { ecosystem: ghEcosystem, package: name } }),
    }, { timeoutMs: 8_000 });
    if (!res.ok) throw new Error(`GHSA request failed with HTTP ${res.status}`);
    data = (await res.json()) as GhsaResponse;
    if (data.errors?.length) {
      throw new Error(`GHSA query failed: ${data.errors[0].message ?? "unknown GraphQL error"}`);
    }
    if (!data.data?.securityVulnerabilities || !Array.isArray(data.data.securityVulnerabilities.edges)) {
      throw new Error("GHSA response has an invalid schema");
    }
  } catch (error) {
    throw error instanceof Error ? error : new Error("GHSA request failed");
  }

  const edges = data.data.securityVulnerabilities.edges;

  return edges
    .filter((e) => {
      const range = e.node.vulnerableVersionRange;
      if (!range || !range.trim()) return true; // no range = affects all
      try {
        return versionInRange(version, range);
      } catch {
        return true; // include on parse failure to avoid false negatives
      }
    })
    .map((e) => {
      const { advisory, firstPatchedVersion } = e.node;
      return {
        id: advisory.ghsaId,
        aliases: [],
        severity: ghsaSeverityToSeverity(advisory.severity),
        summary: advisory.summary,
        details: advisory.description,
        fixedVersions: firstPatchedVersion ? [firstPatchedVersion.identifier] : [],
        source: "GHSA" as const,
        confidence: "high" as const,
        url: `https://github.com/advisories/${advisory.ghsaId}`,
        publishedAt: advisory.publishedAt,
      };
    });
}
