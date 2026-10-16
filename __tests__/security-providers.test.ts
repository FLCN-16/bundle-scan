import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

import { queryGhsa } from "../lib/security/ghsa";
import { queryOsv } from "../lib/security/osv";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GITHUB_TOKEN;
});

describe("OSV provider", () => {
  it("interprets CVSS vectors and only reports fixes for the requested package", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      vulns: [{
        id: "CVE-2026-0001",
        severity: [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" }],
        affected: [
          { package: { name: "requested", ecosystem: "npm" }, ranges: [{ type: "SEMVER", events: [{ fixed: "2.0.0" }] }] },
          { package: { name: "other", ecosystem: "npm" }, ranges: [{ type: "SEMVER", events: [{ fixed: "9.0.0" }] }] },
        ],
      }],
    }), { status: 200 }));

    const [advisory] = await queryOsv("requested", "npm", "1.0.0");
    expect(advisory.severity).toBe("critical");
    expect(advisory.fixedVersions).toEqual(["2.0.0"]);
  });

  it("rejects provider failures so aggregation can mark OSV unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 503 }));
    await expect(queryOsv("requested", "npm", "1.0.0")).rejects.toThrow("HTTP 503");
  });
});

describe("GitHub Advisory provider", () => {
  it("maps canonical PyPI names to GitHub's PIP ecosystem", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      data: {
        securityVulnerabilities: {
          edges: [{
            node: {
              advisory: {
                ghsaId: "GHSA-test",
                summary: "Test advisory",
                severity: "HIGH",
                publishedAt: "2026-01-01T00:00:00Z",
                references: [],
              },
              vulnerableVersionRange: ">=1.0.0 <2.0.0",
              firstPatchedVersion: { identifier: "2.0.0" },
            },
          }],
        },
      },
    }), { status: 200 }));

    const advisories = await queryGhsa("requests", "PyPI", "1.5.0");
    expect(advisories).toHaveLength(1);
    expect(advisories[0].id).toBe("GHSA-test");
  });
});
