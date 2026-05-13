"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { Advisory, Severity } from "@/lib/types";
import { versionInRange } from "./semver";

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
  data?: {
    securityVulnerabilities?: {
      edges?: GhsaEdge[];
    };
  };
}

const ECOSYSTEM_MAP: Record<string, string> = {
  npm: "NPM",
  PyPI: "PIP",
  Maven: "MAVEN",
};

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
  if (!token) return [];

  const ghEcosystem = ECOSYSTEM_MAP[ecosystem];
  if (!ghEcosystem) return [];

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
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { ecosystem: ghEcosystem, package: name } }),
    });
    if (!res.ok) return [];
    data = (await res.json()) as GhsaResponse;
  } catch {
    return [];
  }

  const edges = data.data?.securityVulnerabilities?.edges ?? [];

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
