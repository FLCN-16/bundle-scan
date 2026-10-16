import { NextRequest, NextResponse } from "next/server";
import { aggregateSecurity } from "@/lib/security/aggregate";
import { fetchWithRetry } from "@/lib/http";
import { cmpSemver, compareVersions, versionInRange } from "@/lib/security/semver";

function cleanVersion(range: string): string {
  // Strip outer parens (PyPI style): (>=2,<4) → >=2,<4
  const s = range.split("||")[0].trim().replace(/^\(|\)$/g, "").trim();
  // Exact pin: ==2.31.0
  const exact = s.match(/^==([^\s,]+)/);
  if (exact) return exact[1];
  // Lower bound: >=2.0 or >=2.0,<4
  const lower = s.match(/(?:^|,)\s*>=([^\s,]+)/);
  if (lower) return lower[1];
  // Compatible release: ~=2.0
  const compat = s.match(/^~=([^\s,]+)/);
  if (compat) return compat[1];
  // npm-style: strip leading ^~>=< operators
  const npm = s.replace(/^[\^~>=<\s*]+/, "").split(/[\s,]/)[0].trim();
  return npm || "latest";
}

function npmPath(name: string) {
  return encodeURIComponent(name).replace(/%40/g, "@").replace(/%2F/g, "/");
}

function isConcreteVersion(value: string): boolean {
  return /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value.trim());
}

async function fetchBundlephobia(
  name: string,
  version: string
): Promise<{ minified?: number; gzipSize?: number }> {
  try {
    const res = await fetchWithRetry(
      `https://bundlephobia.com/api/size?package=${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 86400 } },
      { timeoutMs: 8_000 },
    );
    if (!res.ok) return {};
    const data = await res.json() as { size?: number; gzip?: number };
    return { minified: data.size, gzipSize: data.gzip };
  } catch {
    return {};
  }
}

async function fetchNpmMeta(
  name: string,
  version: string
): Promise<{ unpackedSize?: number; minified?: number; gzipSize?: number; resolvedVersion: string }> {
  const clean = cleanVersion(version);
  const encoded = npmPath(name);

  const tryFetch = async (v: string) => {
    const res = await fetchWithRetry(
      `https://registry.npmjs.org/${encoded}/${encodeURIComponent(v)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 86400 } },
      { timeoutMs: 8_000 },
    );
    if (!res.ok) return null;
    return res.json() as Promise<{ version: string; dist?: { unpackedSize?: number } }>;
  };

  let resolvedVersion = clean;
  const rangeLike = /[\^~<>=*|,\s]/.test(version) || (!isConcreteVersion(version) && /^\d/.test(version));
  let data = rangeLike ? null : await tryFetch(clean);

  // A manifest range is not an installed version. Resolve it against the
  // registry's published versions before looking up security advisories so a
  // lower bound such as ^4.17.20 is not scanned as 4.17.20.
  if (!data && rangeLike) {
    const res = await fetchWithRetry(
      `https://registry.npmjs.org/${encoded}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 86400 } },
      { timeoutMs: 12_000 },
    );
    if (!res.ok) throw new Error(`npm: unable to resolve range ${name}@${version} (HTTP ${res.status})`);
    const packument = await res.json() as {
      versions?: Record<string, unknown>;
    };
    const match = Object.keys(packument.versions ?? {})
      .filter((candidate) => compareVersions(candidate, candidate) !== null && versionInRange(candidate, version))
      .sort((a, b) => cmpSemver(b, a))[0];
    if (!match) throw new Error(`npm: no published version satisfies ${name}@${version}`);
    resolvedVersion = match;
    data = await tryFetch(resolvedVersion);
  }

  if (!data && clean === "latest") data = await tryFetch("latest");
  if (!data) return { resolvedVersion };

  resolvedVersion = data.version ?? resolvedVersion;
  const bp = await fetchBundlephobia(name, resolvedVersion);

  return {
    unpackedSize: data.dist?.unpackedSize,
    minified: bp.minified,
    gzipSize: bp.gzipSize,
    resolvedVersion,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const name = searchParams.get("name");
  const version = searchParams.get("version") ?? "latest";
  const ecosystem = searchParams.get("ecosystem") ?? "npm";

  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  try {
    const secVersion = cleanVersion(version);
    const concreteSecurity = ecosystem === "npm" && isConcreteVersion(secVersion)
      ? aggregateSecurity(name, ecosystem, secVersion)
      : null;
    const [npmMeta, earlySecurity] = await Promise.all([
      ecosystem === "npm" ? fetchNpmMeta(name, version) : Promise.resolve({ resolvedVersion: secVersion }),
      concreteSecurity ?? Promise.resolve(null),
    ]);
    const security = earlySecurity ?? await aggregateSecurity(name, ecosystem, npmMeta.resolvedVersion || secVersion);

    return NextResponse.json({ ...npmMeta, security });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
