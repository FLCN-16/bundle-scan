import { describe, expect, it } from "vitest";
import { cmpSemver, versionInRange } from "../lib/security/semver";

describe("semver comparison", () => {
  it("orders numeric components instead of comparing them as strings", () => {
    expect(cmpSemver("1.10.0", "1.2.0")).toBeGreaterThan(0);
  });

  it("orders prereleases before their stable release", () => {
    expect(cmpSemver("1.0.0-beta.1", "1.0.0")).toBeLessThan(0);
  });
});

describe("versionInRange", () => {
  it("handles space-separated comparator ranges and their boundaries", () => {
    expect(versionInRange("1.0.0", ">=1.0.0 <2.0.0")).toBe(true);
    expect(versionInRange("1.9.9", ">=1.0.0 <2.0.0")).toBe(true);
    expect(versionInRange("2.0.0", ">=1.0.0 <2.0.0")).toBe(false);
    expect(versionInRange("0.9.9", ">=1.0.0 <2.0.0")).toBe(false);
  });

  it("supports caret, tilde, wildcard, OR, and hyphen ranges", () => {
    expect(versionInRange("1.5.0", "^1.0.0")).toBe(true);
    expect(versionInRange("2.0.0", "^1.0.0")).toBe(false);
    expect(versionInRange("1.2.9", "~1.2.0")).toBe(true);
    expect(versionInRange("1.3.0", "~1.2.0")).toBe(false);
    expect(versionInRange("1.2.7", "1.2.x")).toBe(true);
    expect(versionInRange("2.1.0", "^1.0.0 || ^2.0.0")).toBe(true);
    expect(versionInRange("1.5.0", "1.0.0 - 1.4.9")).toBe(false);
    expect(versionInRange("1.2.4", "!=1.2.3")).toBe(true);
    expect(versionInRange("1.2.3", "!=1.2.3")).toBe(false);
  });

  it("does not treat malformed ranges as matching every version", () => {
    expect(versionInRange("2.0.0", "not-a-range")).toBe(false);
  });
});
