import { parse as parseToml } from "smol-toml";

export interface ParsedPackage {
  name: string;
  version: string;
  /** Original manifest constraint, when the file provided a range instead of a pin. */
  requestedVersion?: string;
  registry: "npm" | "pypi" | "maven";
}

export function parsePackageJson(content: string): ParsedPackage[] {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid JSON in package.json");
  }

  const result: ParsedPackage[] = [];
  for (const field of ["dependencies", "devDependencies", "peerDependencies"] as const) {
    const deps = json[field];
    if (!deps || typeof deps !== "object") continue;
    for (const [name, ver] of Object.entries(deps as Record<string, string>)) {
      if (typeof ver !== "string") continue;
      // Strip semver range chars to get a plain version; fall back to "latest"
      const cleanVer = ver.replace(/^[\^~>=<*\s]+/, "").split(" ")[0] ?? "latest";
      result.push({ name, version: cleanVer || "latest", requestedVersion: ver, registry: "npm" });
    }
  }
  return result;
}

export function parseRequirementsTxt(content: string): ParsedPackage[] {
  const result: ParsedPackage[] = [];
  for (const raw of content.split("\n")) {
    const line = raw.split("#")[0].trim(); // strip comments
    if (!line || line.startsWith("-") || line.startsWith("http")) continue;
    // formats: name==1.0, name>=1.0, name~=1.0, name[extra]==1.0, name
    const m = line.match(/^([A-Za-z0-9_.\-]+)(?:\[[^\]]+\])?(?:==|>=|~=|<=|!=|>|<)([^\s,;]+)/);
    if (m) {
      result.push({ name: m[1], version: m[2].split(",")[0], registry: "pypi" });
    } else {
      const nameOnly = line.match(/^([A-Za-z0-9_.\-]+)/);
      if (nameOnly) result.push({ name: nameOnly[1], version: "latest", registry: "pypi" });
    }
  }
  return result;
}

export function parsePomXml(content: string): ParsedPackage[] {
  const result: ParsedPackage[] = [];
  const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
  let m;
  while ((m = depRegex.exec(content)) !== null) {
    const block = m[1];
    const g = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1]?.trim();
    const a = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1]?.trim();
    const v = block.match(/<version>([^<]+)<\/version>/)?.[1]?.trim();
    if (g && a) {
      result.push({ name: `${g}/${a}`, version: v ?? "latest", registry: "maven" });
    }
  }
  return result;
}

function parsePypiDepString(dep: string): ParsedPackage | null {
  const line = dep.trim();
  if (!line) return null;
  const m = line.match(/^([A-Za-z0-9_.\-]+)(?:\[[^\]]+\])?(?:==|>=|~=|<=|!=|>|<)([^\s,;]+)/);
  if (m) return { name: m[1], version: m[2].split(",")[0], registry: "pypi" };
  const nameOnly = line.match(/^([A-Za-z0-9_.\-]+)/);
  if (nameOnly) return { name: nameOnly[1], version: "latest", registry: "pypi" };
  return null;
}

function extractPoetryVersion(val: unknown): string {
  if (typeof val === "string") {
    if (val === "*") return "latest";
    return val.replace(/^[\^~>=<*\s]+/, "").split(/[,\s]/)[0] || "latest";
  }
  if (val && typeof val === "object") {
    const v = (val as Record<string, unknown>).version;
    if (typeof v === "string") return extractPoetryVersion(v);
  }
  return "latest";
}

export function parsePyprojectToml(content: string): ParsedPackage[] {
  const result: ParsedPackage[] = [];
  let toml: Record<string, unknown>;
  try { toml = parseToml(content) as Record<string, unknown>; } catch { return result; }

  // ── PEP 621 ──
  const project = toml.project as Record<string, unknown> | undefined;
  if (project) {
    for (const dep of (project.dependencies as string[] | undefined) ?? []) {
      const p = parsePypiDepString(dep); if (p) result.push(p);
    }
    const optDeps = project["optional-dependencies"] as Record<string, string[]> | undefined;
    for (const group of Object.values(optDeps ?? {})) {
      for (const dep of group) { const p = parsePypiDepString(dep); if (p) result.push(p); }
    }
  }

  // ── Poetry ──
  const tool = toml.tool as Record<string, unknown> | undefined;
  const poetry = tool?.poetry as Record<string, unknown> | undefined;
  if (poetry) {
    const addPoetryDeps = (deps: Record<string, unknown> | undefined) => {
      for (const [name, val] of Object.entries(deps ?? {})) {
        if (name.toLowerCase() === "python") continue;
        result.push({ name, version: extractPoetryVersion(val), registry: "pypi" });
      }
    };
    addPoetryDeps(poetry.dependencies as Record<string, unknown> | undefined);
    addPoetryDeps(poetry["dev-dependencies"] as Record<string, unknown> | undefined);
    const groups = poetry.group as Record<string, Record<string, unknown>> | undefined;
    for (const group of Object.values(groups ?? {})) {
      addPoetryDeps(group.dependencies as Record<string, unknown> | undefined);
    }
  }

  return result;
}

export function parseUvLock(content: string): ParsedPackage[] {
  const result: ParsedPackage[] = [];
  let toml: Record<string, unknown>;
  try { toml = parseToml(content) as Record<string, unknown>; } catch { return result; }
  const packages = toml.package as Array<{ name?: string; version?: string }> | undefined;
  for (const pkg of packages ?? []) {
    if (pkg.name && pkg.version) {
      result.push({ name: pkg.name, version: pkg.version, registry: "pypi" });
    }
  }
  return result;
}

export function detectAppMeta(filename: string, content: string): { name: string | null; description: string | null } {
  const lower = filename.toLowerCase();

  if (lower === "package.json" || lower.endsWith("/package.json") || content.trimStart().startsWith("{")) {
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      return {
        name: typeof json.name === "string" && json.name ? json.name : null,
        description: typeof json.description === "string" && json.description ? json.description : null,
      };
    } catch { return { name: null, description: null }; }
  }

  if (lower === "pyproject.toml" || lower.endsWith("/pyproject.toml") ||
      content.includes("[project]") || content.includes("[tool.poetry]")) {
    try {
      const toml = parseToml(content) as Record<string, unknown>;
      const project = toml.project as Record<string, unknown> | undefined;
      const poetry = (toml.tool as Record<string, unknown> | undefined)?.poetry as Record<string, unknown> | undefined;
      const name = (project?.name ?? poetry?.name) as string | undefined;
      const description = (project?.description ?? poetry?.description) as string | undefined;
      return { name: name ?? null, description: description ?? null };
    } catch { return { name: null, description: null }; }
  }

  if (lower === "pom.xml" || lower.endsWith("/pom.xml") || content.includes("<dependency>")) {
    const beforeDeps = content.split("<dependency>")[0];
    const name = beforeDeps.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1]?.trim() ?? null;
    const description = beforeDeps.match(/<description>([^<]+)<\/description>/)?.[1]?.trim() ?? null;
    return { name, description };
  }

  return { name: null, description: null };
}

export function detectAppName(filename: string, content: string): string | null {
  return detectAppMeta(filename, content).name;
}

export function detectAndParse(filename: string, content: string): ParsedPackage[] {
  const lower = filename.toLowerCase();
  if (lower === "package.json" || lower.endsWith("/package.json")) return parsePackageJson(content);
  if (lower === "requirements.txt" || lower.endsWith("/requirements.txt")) return parseRequirementsTxt(content);
  if (lower === "pom.xml" || lower.endsWith("/pom.xml")) return parsePomXml(content);
  if (lower === "pyproject.toml" || lower.endsWith("/pyproject.toml")) return parsePyprojectToml(content);
  if (lower === "uv.lock" || lower.endsWith("/uv.lock")) return parseUvLock(content);
  // Auto-detect
  if (content.trimStart().startsWith("{")) return parsePackageJson(content);
  if (content.includes("<dependency>")) return parsePomXml(content);
  if (content.includes("[project]") || content.includes("[tool.poetry]")) return parsePyprojectToml(content);
  if (content.includes("[[package]]") && content.includes('registry = "https://pypi.org')) return parseUvLock(content);
  return parseRequirementsTxt(content);
}
