export interface ParsedPackage {
  name: string;
  version: string;
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
      // Strip semver range chars to get a plain version; fall back to "latest"
      const cleanVer = ver.replace(/^[\^~>=<*\s]+/, "").split(" ")[0] ?? "latest";
      result.push({ name, version: cleanVer || "latest", registry: "npm" });
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

export function parsePyprojectToml(content: string): ParsedPackage[] {
  const result: ParsedPackage[] = [];

  function addPypiDep(raw: string) {
    // requirements-style string: "requests>=2.28", "fastapi[all]>=0.100"
    const line = raw.replace(/^["'\s]+|["'\s,]+$/g, "");
    if (!line) return;
    const m = line.match(/^([A-Za-z0-9_.\-]+)(?:\[[^\]]+\])?(?:==|>=|~=|<=|!=|>|<)([^\s,;]+)/);
    if (m) {
      result.push({ name: m[1], version: m[2].split(",")[0], registry: "pypi" });
    } else {
      const nameOnly = line.match(/^([A-Za-z0-9_.\-]+)/);
      if (nameOnly && nameOnly[1].toLowerCase() !== "python") {
        result.push({ name: nameOnly[1], version: "latest", registry: "pypi" });
      }
    }
  }

  // ── PEP 621: [project] dependencies = ["pkg>=1.0", ...] ──
  const pep621 = content.match(/\[project\][\s\S]*?^dependencies\s*=\s*\[([\s\S]*?)\]/m);
  if (pep621) {
    for (const line of pep621[1].split("\n")) addPypiDep(line);
  }
  const optDeps = content.match(/\[project\.optional-dependencies\][^\[]*\w+\s*=\s*\[([\s\S]*?)\]/gm);
  if (optDeps) {
    for (const block of optDeps) {
      const inner = block.match(/\[([\s\S]*?)\]/)?.[1] ?? "";
      for (const line of inner.split("\n")) addPypiDep(line);
    }
  }

  // ── Poetry: [tool.poetry.dependencies] / dev-dependencies / group deps ──
  const poetryRe = /\[tool\.poetry(?:\.group\.[^.[\]]+)?\.(?:dev-)?dependencies\]([\s\S]*?)(?=\[|$)/gm;
  let sm: RegExpExecArray | null;
  while ((sm = poetryRe.exec(content)) !== null) {
    for (const raw of sm[1].split("\n")) {
      const line = raw.split("#")[0].trim();
      if (!line || !line.includes("=")) continue;
      const eqIdx = line.indexOf("=");
      const name = line.slice(0, eqIdx).trim();
      if (!name || name.toLowerCase() === "python" || name.startsWith("[")) continue;
      const val = line.slice(eqIdx + 1).trim();
      // inline table: {version = "^x.y"} or simple: "^x.y"
      const verStr =
        val.match(/version\s*=\s*["']([^"']+)["']/)?.[1] ??
        val.match(/["']([^"']+)["']/)?.[1] ?? "";
      const version = verStr === "*" ? "latest"
        : verStr.replace(/^[\^~>=<*\s]+/, "").split(/[,\s]/)[0] || "latest";
      result.push({ name, version, registry: "pypi" });
    }
  }

  return result;
}

export function detectAppName(filename: string, content: string): string | null {
  const lower = filename.toLowerCase();
  if (lower === "package.json" || lower.endsWith("/package.json") || content.trimStart().startsWith("{")) {
    try {
      const json = JSON.parse(content) as Record<string, unknown>;
      return typeof json.name === "string" && json.name ? json.name : null;
    } catch { return null; }
  }
  if (lower === "pyproject.toml" || lower.endsWith("/pyproject.toml")) {
    return (
      content.match(/\[project\][\s\S]*?^name\s*=\s*["']([^"']+)["']/m)?.[1] ??
      content.match(/\[tool\.poetry\][\s\S]*?^name\s*=\s*["']([^"']+)["']/m)?.[1] ??
      null
    );
  }
  if (lower === "pom.xml" || lower.endsWith("/pom.xml") || content.includes("<dependency>")) {
    const beforeDeps = content.split("<dependency>")[0];
    const m = beforeDeps.match(/<artifactId>([^<]+)<\/artifactId>/);
    return m ? m[1].trim() : null;
  }
  return null;
}

export function detectAndParse(filename: string, content: string): ParsedPackage[] {
  const lower = filename.toLowerCase();
  if (lower === "package.json" || lower.endsWith("/package.json")) return parsePackageJson(content);
  if (lower === "requirements.txt" || lower.endsWith("/requirements.txt")) return parseRequirementsTxt(content);
  if (lower === "pom.xml" || lower.endsWith("/pom.xml")) return parsePomXml(content);
  if (lower === "pyproject.toml" || lower.endsWith("/pyproject.toml")) return parsePyprojectToml(content);
  // Auto-detect
  if (content.trimStart().startsWith("{")) return parsePackageJson(content);
  if (content.includes("<dependency>")) return parsePomXml(content);
  if (content.includes("[project]") || content.includes("[tool.poetry]")) return parsePyprojectToml(content);
  return parseRequirementsTxt(content);
}
