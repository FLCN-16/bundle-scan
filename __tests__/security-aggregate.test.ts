import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock("../lib/security/osv", () => ({ queryOsv: vi.fn() }));
vi.mock("../lib/security/ghsa", () => ({ queryGhsa: vi.fn() }));
vi.mock("../lib/security/nvd", () => ({ queryNvd: vi.fn() }));

import { aggregateSecurity } from "../lib/security/aggregate";
import { queryGhsa } from "../lib/security/ghsa";
import { queryNvd } from "../lib/security/nvd";
import { queryOsv } from "../lib/security/osv";

const advisory = {
  id: "CVE-2026-0001",
  aliases: [],
  severity: "high" as const,
  summary: "Test advisory",
  fixedVersions: [],
  source: "OSV" as const,
  confidence: "high" as const,
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("security aggregation", () => {
  it("does not report a clean scan when every provider is unavailable", async () => {
    vi.mocked(queryOsv).mockRejectedValue(new Error("OSV down"));
    vi.mocked(queryGhsa).mockRejectedValue(new Error("token missing"));
    vi.mocked(queryNvd).mockRejectedValue(new Error("NVD down"));

    const result = await aggregateSecurity("pkg", "npm", "1.0.0");
    expect(result.advisories).toEqual([]);
    expect(result.sources).toEqual({ osv: false, ghsa: false, nvd: false });
  });

  it("keeps successful advisories while marking failed sources unavailable", async () => {
    vi.mocked(queryOsv).mockResolvedValue([advisory]);
    vi.mocked(queryGhsa).mockRejectedValue(new Error("GHSA down"));
    vi.mocked(queryNvd).mockResolvedValue([]);

    const result = await aggregateSecurity("pkg", "npm", "1.0.0");
    expect(result.advisories).toHaveLength(1);
    expect(result.sources).toEqual({ osv: true, ghsa: false, nvd: true });
  });
});
