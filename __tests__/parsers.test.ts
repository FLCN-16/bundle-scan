import { describe, expect, it } from "vitest";
import { parsePackageJson, parsePyprojectToml, parseRequirementsTxt } from "../lib/parsers";

describe("dependency parsers", () => {
  it("preserves npm ranges for later concrete-version resolution", () => {
    const [dependency] = parsePackageJson(JSON.stringify({ dependencies: { react: "^19.0.0" } }));
    expect(dependency).toMatchObject({
      name: "react",
      version: "19.0.0",
      requestedVersion: "^19.0.0",
      registry: "npm",
    });
  });

  it("does not drop valid packages whose names start with python", () => {
    expect(parsePyprojectToml(`
      [project]
      dependencies = ["python-dateutil==2.9.0"]
    `)).toEqual([
      { name: "python-dateutil", version: "2.9.0", registry: "pypi" },
    ]);
  });

  it("parses Python extras and inline comments", () => {
    expect(parseRequirementsTxt("requests[security]==2.31.0 # pinned\npython-dateutil==2.9.0")).toEqual([
      { name: "requests", version: "2.31.0", registry: "pypi" },
      { name: "python-dateutil", version: "2.9.0", registry: "pypi" },
    ]);
  });
});
