function parseSemver(v: string): [number, number, number] {
  const clean = v.replace(/^\s*[v=]?\s*/, "").split("-")[0]; // strip pre-release
  const m = clean.match(/^(\d+)\.?(\d*)\.?(\d*)$/);
  if (!m) return [0, 0, 0];
  return [parseInt(m[1] || "0"), parseInt(m[2] || "0"), parseInt(m[3] || "0")];
}

export function cmpSemver(a: string, b: string): number {
  const [a0, a1, a2] = parseSemver(a);
  const [b0, b1, b2] = parseSemver(b);
  if (a0 !== b0) return a0 - b0;
  if (a1 !== b1) return a1 - b1;
  return a2 - b2;
}

// Checks whether `version` satisfies a range string like ">= 1.0.0, < 2.0.0"
export function versionInRange(version: string, range: string): boolean {
  const conditions = range
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const cond of conditions) {
    const m = cond.match(/^([><=!]+)\s*v?(.+)$/);
    if (!m) continue;
    const [, op, ver] = m;
    const cmp = cmpSemver(version, ver.trim());
    if (op === ">=" && cmp < 0) return false;
    if (op === ">" && cmp <= 0) return false;
    if (op === "<=" && cmp > 0) return false;
    if (op === "<" && cmp >= 0) return false;
    if ((op === "=" || op === "==") && cmp !== 0) return false;
  }
  return true;
}
