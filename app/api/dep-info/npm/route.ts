import { NextRequest, NextResponse } from "next/server";
import { aggregateSecurity } from "@/lib/security/aggregate";

function cleanVersion(range: string): string {
  // Strip outer parens (PyPI style): (>=2,<4) → >=2,<4
  let s = range.split("||")[0].trim().replace(/^\(|\)$/g, "").trim();
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

async function fetchBundlephobia(
  name: string,
  version: string
): Promise<{ minified?: number; gzipSize?: number }> {
  try {
    const res = await fetch(
      `https://bundlephobia.com/api/size?package=${encodeURIComponent(name)}@${encodeURIComponent(version)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 86400 } }
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
    const res = await fetch(
      `https://registry.npmjs.org/${encoded}/${encodeURIComponent(v)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    return res.json() as Promise<{ version: string; dist?: { unpackedSize?: number } }>;
  };

  let data = await tryFetch(clean);
  if (!data) data = await tryFetch("latest");
  if (!data) return { resolvedVersion: clean };

  const resolvedVersion = data.version ?? clean;
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
    const [npmMeta, security] = await Promise.all([
      ecosystem === "npm" ? fetchNpmMeta(name, version) : Promise.resolve({ resolvedVersion: secVersion }),
      aggregateSecurity(name, ecosystem, secVersion),
    ]);

    return NextResponse.json({ ...npmMeta, security });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
