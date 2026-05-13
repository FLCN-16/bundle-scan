"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { Advisory, Severity } from "@/lib/types";

interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  database_specific?: { severity?: string };
  affected?: Array<{
    ranges?: Array<{
      type: string;
      events: Array<{ introduced?: string; fixed?: string }>;
    }>;
  }>;
  published?: string;
  references?: Array<{ type: string; url: string }>;
}

interface OsvResponse {
  vulns?: OsvVuln[];
}

function cvssToSeverity(score: number): Severity {
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "unknown";
}

function parseSeverity(vuln: OsvVuln): Severity {
  const dbSev = vuln.database_specific?.severity?.toLowerCase();
  if (dbSev === "critical") return "critical";
  if (dbSev === "high") return "high";
  if (dbSev === "medium" || dbSev === "moderate") return "medium";
  if (dbSev === "low") return "low";

  const cvss = vuln.severity?.find(
    (s) => s.type === "CVSS_V3" || s.type === "CVSS_V2"
  );
  if (cvss) {
    const m = cvss.score.match(/\/(\d+\.\d+)$/);
    const base = m ? parseFloat(m[1]) : 0;
    if (!isNaN(base)) return cvssToSeverity(base);
  }
  return "unknown";
}

function extractFixed(vuln: OsvVuln): string[] {
  const fixed: string[] = [];
  for (const aff of vuln.affected ?? []) {
    for (const range of aff.ranges ?? []) {
      for (const ev of range.events) {
        if (ev.fixed) fixed.push(ev.fixed);
      }
    }
  }
  return [...new Set(fixed)];
}

export async function queryOsv(
  name: string,
  ecosystem: string,
  version: string
): Promise<Advisory[]> {
  "use cache";
  cacheTag(`osv:${ecosystem}:${name}:${version}`);
  cacheLife("hours");

  const body = { version, package: { name, ecosystem } };
  let data: OsvResponse;
  try {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    data = (await res.json()) as OsvResponse;
  } catch {
    return [];
  }

  return (data.vulns ?? []).map((v) => ({
    id: v.id,
    aliases: v.aliases ?? [],
    severity: parseSeverity(v),
    summary: v.summary ?? v.id,
    details: v.details,
    fixedVersions: extractFixed(v),
    source: "OSV" as const,
    confidence: "high" as const,
    url: v.references?.find((r) => r.type === "ADVISORY")?.url ??
      `https://osv.dev/vulnerability/${v.id}`,
    publishedAt: v.published,
  }));
}
