"use cache";

import { cacheLife, cacheTag } from "next/cache";
import type { Advisory, SecurityResult } from "@/lib/types";
import { queryOsv } from "./osv";
import { queryGhsa } from "./ghsa";
import { queryNvd } from "./nvd";

const ECOSYSTEM_MAP: Record<string, string> = {
  npm: "npm",
  PyPI: "PyPI",
  Maven: "Maven",
};

function dedupeAdvisories(advisories: Advisory[]): Advisory[] {
  const seen = new Map<string, Advisory>();

  for (const adv of advisories) {
    const ids = [adv.id, ...adv.aliases];
    const existingKey = ids.find((id) => seen.has(id));

    if (existingKey) {
      const existing = seen.get(existingKey)!;
      // Prefer high-confidence source
      if (adv.confidence === "high" && existing.confidence === "low") {
        for (const id of ids) seen.set(id, { ...adv, aliases: [...new Set([...adv.aliases, ...existing.aliases, existing.id])] });
      }
    } else {
      const entry = adv;
      for (const id of ids) seen.set(id, entry);
    }
  }

  return [...new Set(seen.values())];
}

export async function aggregateSecurity(
  name: string,
  ecosystem: string,
  version: string
): Promise<SecurityResult> {
  "use cache";
  cacheTag(`sec:${ecosystem}:${name}:${version}`);
  cacheLife("hours");

  const osvEco = ECOSYSTEM_MAP[ecosystem] ?? ecosystem;

  const [osvResults, ghsaResults, nvdResults] = await Promise.allSettled([
    queryOsv(name, osvEco, version),
    queryGhsa(name, ecosystem, version),
    queryNvd(name, ecosystem, version),
  ]);

  const allAdvisories: Advisory[] = [
    ...(osvResults.status === "fulfilled" ? osvResults.value : []),
    ...(ghsaResults.status === "fulfilled" ? ghsaResults.value : []),
    ...(nvdResults.status === "fulfilled" ? nvdResults.value : []),
  ];

  const deduped = dedupeAdvisories(allAdvisories).sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
    return order[a.severity] - order[b.severity];
  });

  return {
    advisories: deduped,
    sources: {
      osv: osvResults.status === "fulfilled",
      ghsa: ghsaResults.status === "fulfilled",
      nvd: nvdResults.status === "fulfilled",
    },
    scannedAt: new Date().toISOString(),
  };
}
