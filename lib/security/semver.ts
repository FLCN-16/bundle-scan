interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: Array<string | number>;
  minorSpecified: boolean;
  patchSpecified: boolean;
}

interface Comparator {
  operator: ">" | ">=" | "<" | "<=" | "=" | "!=";
  version: ParsedVersion;
}

const VERSION_TOKEN =
  /(?:\^|~|>=|<=|!=|>|<|==|=)?\s*v?\d+(?:\.(?:\d+|x|X|\*))?(?:\.(?:\d+|x|X|\*))?(?:-[0-9A-Za-z.-]+)?/g;

function parseVersion(value: string, allowWildcards = false): ParsedVersion | null {
  const clean = value.trim().replace(/^[v=]\s*/, "").split("+")[0];
  const match = clean.match(
    /^(\d+)(?:\.(\d+|x|X|\*))?(?:\.(\d+|x|X|\*))?(?:-([0-9A-Za-z.-]+))?$/
  );
  if (!match) return null;

  const minorSpecified = match[2] !== undefined;
  const patchSpecified = match[3] !== undefined;
  const minor = match[2] && !/^[xX*]$/.test(match[2]) ? Number(match[2]) : 0;
  const patch = match[3] && !/^[xX*]$/.test(match[3]) ? Number(match[3]) : 0;

  if (!allowWildcards && ((match[2] && /^[xX*]$/.test(match[2])) || (match[3] && /^[xX*]$/.test(match[3])))) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor,
    patch,
    prerelease: match[4]
      ? match[4].split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
      : [],
    minorSpecified,
    patchSpecified,
  };
}

function compareParsedVersions(a: ParsedVersion, b: ParsedVersion): number {
  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) return a[key] - b[key];
  }

  if (a.prerelease.length === 0 && b.prerelease.length > 0) return 1;
  if (a.prerelease.length > 0 && b.prerelease.length === 0) return -1;
  for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
    const left = a.prerelease[i];
    const right = b.prerelease[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;
    if (left === right) continue;
    if (typeof left === "number" && typeof right === "number") return left - right;
    if (typeof left === "number") return -1;
    if (typeof right === "number") return 1;
    return left < right ? -1 : 1;
  }
  return 0;
}

/** Compare two concrete semver-like versions. Returns null when either value is not comparable. */
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  return compareParsedVersions(left, right);
}

export function cmpSemver(a: string, b: string): number {
  return compareVersions(a, b) ?? 0;
}

function upperBoundForCaret(version: ParsedVersion): ParsedVersion {
  if (!version.minorSpecified) return { ...version, major: version.major + 1, minor: 0, patch: 0, prerelease: [] };
  if (version.major > 0) return { ...version, major: version.major + 1, minor: 0, patch: 0, prerelease: [] };
  if (!version.patchSpecified) return { ...version, minor: version.minor + 1, patch: 0, prerelease: [] };
  if (version.minor > 0) return { ...version, minor: version.minor + 1, patch: 0, prerelease: [] };
  return { ...version, patch: version.patch + 1, prerelease: [] };
}

function upperBoundForTilde(version: ParsedVersion): ParsedVersion {
  if (!version.minorSpecified) return { ...version, major: version.major + 1, minor: 0, patch: 0, prerelease: [] };
  return { ...version, minor: version.minor + 1, patch: 0, prerelease: [] };
}

function comparator(operator: Comparator["operator"], version: ParsedVersion): Comparator {
  return { operator, version: { ...version, minorSpecified: true, patchSpecified: true } };
}

function parseComparatorSet(input: string): Comparator[] | null {
  const range = input.trim();
  if (!range || range === "*" || /^x$/i.test(range)) return [];

  const hyphen = range.match(
    /^\s*(v?\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?)\s+-\s*(v?\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?)\s*$/
  );
  if (hyphen) {
    const lower = parseVersion(hyphen[1]);
    const upper = parseVersion(hyphen[2]);
    if (!lower || !upper) return null;
    return [comparator(">=", lower), comparator("<=", upper)];
  }

  const matches = [...range.matchAll(VERSION_TOKEN)];
  const remainder = range.replace(VERSION_TOKEN, "").replace(/[\s,]+/g, "");
  if (!matches.length || remainder.length > 0) return null;

  const result: Comparator[] = [];
  for (const match of matches) {
    const token = match[0].trim();
    const operatorMatch = token.match(/^(\^|~|>=|<=|!=|>|<|==|=)?\s*/);
    const operator = operatorMatch?.[1] ?? "=";
    const versionText = token.slice(operatorMatch?.[0].length ?? 0).trim();
    const version = parseVersion(versionText, true);
    if (!version) return null;

    const wildcard = !version.patchSpecified || /[xX*]/.test(versionText);
    if (operator === "^") {
      result.push(comparator(">=", version));
      result.push(comparator("<", upperBoundForCaret(version)));
    } else if (operator === "~") {
      result.push(comparator(">=", version));
      result.push(comparator("<", upperBoundForTilde(version)));
    } else if (wildcard && (operator === "=" || operator === "==")) {
      result.push(comparator(">=", version));
      if (!version.minorSpecified || /[xX*]/.test(versionText.split(".")[1] ?? "")) {
        result.push(comparator("<", { ...version, major: version.major + 1, minor: 0, patch: 0, prerelease: [] }));
      } else {
        result.push(comparator("<", { ...version, minor: version.minor + 1, patch: 0, prerelease: [] }));
      }
    } else {
      const mapped = operator === "==" ? "=" : operator;
      if (mapped !== ">" && mapped !== ">=" && mapped !== "<" && mapped !== "<=" && mapped !== "=" && mapped !== "!=") return null;
      result.push(comparator(mapped, version));
    }
  }
  return result;
}

function satisfiesComparator(version: ParsedVersion, condition: Comparator): boolean {
  const cmp = compareParsedVersions(version, condition.version);
  switch (condition.operator) {
    case ">": return cmp > 0;
    case ">=": return cmp >= 0;
    case "<": return cmp < 0;
    case "<=": return cmp <= 0;
    case "=": return cmp === 0;
    case "!=": return cmp !== 0;
  }
}

function sameCore(a: ParsedVersion, b: ParsedVersion): boolean {
  return a.major === b.major && a.minor === b.minor && a.patch === b.patch;
}

/** Check a semver range, including comparator, caret, tilde, wildcard, OR and hyphen ranges. */
export function versionInRange(version: string, range: string): boolean {
  const parsedVersion = parseVersion(version);
  if (!parsedVersion) return false;

  return range
    .split("||")
    .some((alternative) => {
      const conditions = parseComparatorSet(alternative);
      if (!conditions) return false;

      // Like npm semver, a prerelease is only selected by a range that mentions
      // a prerelease for the same release line. This avoids matching beta builds
      // against stable-only advisories.
      if (
        parsedVersion.prerelease.length > 0 &&
        !conditions.some((condition) => sameCore(parsedVersion, condition.version) && condition.version.prerelease.length > 0)
      ) {
        return false;
      }

      return conditions.every((condition) => satisfiesComparator(parsedVersion, condition));
    });
}
