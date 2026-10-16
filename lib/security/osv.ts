"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { Advisory, Severity } from "@/lib/types";
import { fetchWithRetry } from "../http";

interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  database_specific?: { severity?: string };
  affected?: Array<{
    package?: { name?: string; ecosystem?: string };
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
    const base = parseCvssScore(cvss.score);
    if (!isNaN(base)) return cvssToSeverity(base);
  }
  return "unknown";
}

function parseCvssScore(value: string): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  const vector = value.match(/^CVSS:3(?:\.1|\.0)?\/(.+)$/i)?.[1];
  if (!vector) return Number.NaN;
  const metrics = new Map<string, string>();
  for (const part of vector.split("/")) {
    const [key, metric] = part.split(":");
    if (key && metric) metrics.set(key, metric);
  }
  const av = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[metrics.get("AV") ?? ""];
  const ac = { L: 0.77, H: 0.44 }[metrics.get("AC") ?? ""];
  const scope = metrics.get("S");
  if (scope !== "U" && scope !== "C") return Number.NaN;
  const pr = scope === "C"
    ? { N: 0.85, L: 0.68, H: 0.5 }[metrics.get("PR") ?? ""]
    : { N: 0.85, L: 0.62, H: 0.27 }[metrics.get("PR") ?? ""];
  const ui = { N: 0.85, R: 0.62 }[metrics.get("UI") ?? ""];
  const confidentiality = { N: 0, L: 0.22, H: 0.56 }[metrics.get("C") ?? ""];
  const integrity = { N: 0, L: 0.22, H: 0.56 }[metrics.get("I") ?? ""];
  const availability = { N: 0, L: 0.22, H: 0.56 }[metrics.get("A") ?? ""];

  const values = [av, ac, pr, ui, confidentiality, integrity, availability] as const;
  if (values.some((metric) => metric === undefined)) {
    return Number.NaN;
  }
  const [avValue, acValue, prValue, uiValue, confidentialityValue, integrityValue, availabilityValue] = values as [number, number, number, number, number, number, number];

  const impactSubScore = 1 - (1 - confidentialityValue) * (1 - integrityValue) * (1 - availabilityValue);
  if (impactSubScore <= 0) return 0;
  const impact = scope === "C"
    ? 7.52 * (impactSubScore - 0.029) - 3.25 * Math.pow(impactSubScore - 0.02, 15)
    : 6.42 * impactSubScore;
  const exploitability = 8.22 * avValue * acValue * prValue * uiValue;
  const raw = scope === "C" ? Math.min(1.08 * (impact + exploitability), 10) : Math.min(impact + exploitability, 10);
  return Math.ceil(raw * 10) / 10;
}

function extractFixed(vuln: OsvVuln, name: string, ecosystem: string): string[] {
  const fixed: string[] = [];
  for (const aff of vuln.affected ?? []) {
    const packageName = aff.package?.name;
    const packageEcosystem = aff.package?.ecosystem;
    const namesMatch = ecosystem.toLowerCase() === "pypi"
      ? packageName?.toLowerCase() === name.toLowerCase()
      : packageName === name;
    if (packageName && !namesMatch) continue;
    if (packageEcosystem && packageEcosystem.toLowerCase() !== ecosystem.toLowerCase()) continue;
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
    const res = await fetchWithRetry("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, { timeoutMs: 8_000 });
    if (!res.ok) throw new Error(`OSV request failed with HTTP ${res.status}`);
    data = (await res.json()) as OsvResponse;
    if (!data || !Array.isArray(data.vulns)) throw new Error("OSV response has an invalid schema");
  } catch (error) {
    throw error instanceof Error ? error : new Error("OSV request failed");
  }

  return (data.vulns ?? []).map((v) => ({
    id: v.id,
    aliases: v.aliases ?? [],
    severity: parseSeverity(v),
    summary: v.summary ?? v.id,
    details: v.details,
    fixedVersions: extractFixed(v, name, ecosystem),
    source: "OSV" as const,
    confidence: "high" as const,
    url: v.references?.find((r) => r.type === "ADVISORY")?.url ??
      `https://osv.dev/vulnerability/${v.id}`,
    publishedAt: v.published,
  }));
}
