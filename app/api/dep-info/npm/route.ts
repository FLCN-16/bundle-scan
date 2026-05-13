import { NextRequest, NextResponse } from "next/server";
import { aggregateSecurity } from "@/lib/security/aggregate";

function cleanVersion(range: string): string {
  // Strip leading operators and take first clause: ^1.2.3 → 1.2.3, >=1.0,<2.0 → 1.0
  const cleaned = range
    .split("||")[0]
    .trim()
    .replace(/^[\^~>=<\s*]+/, "")
    .split(/[\s,]/)[0]
    .trim();
  return cleaned || "latest";
}

function npmPath(name: string) {
  return encodeURIComponent(name).replace(/%40/g, "@").replace(/%2F/g, "/");
}

async function fetchTarballGzipSize(tarballUrl: string): Promise<number | undefined> {
  try {
    const res = await fetch(tarballUrl, {
      method: "HEAD",
      next: { revalidate: 86400 },
    });
    const len = res.headers.get("content-length");
    return len ? parseInt(len, 10) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchNpmMeta(
  name: string,
  version: string
): Promise<{ unpackedSize?: number; gzipSize?: number; resolvedVersion: string }> {
  const clean = cleanVersion(version);
  const encoded = npmPath(name);

  const tryFetch = async (v: string) => {
    const res = await fetch(
      `https://registry.npmjs.org/${encoded}/${encodeURIComponent(v)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 86400 } }
    );
    if (!res.ok) return null;
    return res.json() as Promise<{ version: string; dist?: { unpackedSize?: number; tarball?: string } }>;
  };

  let data = await tryFetch(clean);
  if (!data) data = await tryFetch("latest");
  if (!data) return { resolvedVersion: clean };

  const gzipSize = data.dist?.tarball
    ? await fetchTarballGzipSize(data.dist.tarball)
    : undefined;

  return {
    unpackedSize: data.dist?.unpackedSize,
    gzipSize,
    resolvedVersion: data.version ?? clean,
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
