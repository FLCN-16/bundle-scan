"use server";

export interface PackageSize {
  bytes: number;
}

function npmPath(name: string) {
  return encodeURIComponent(name).replace(/%40/g, "@").replace(/%2F/g, "/");
}

async function npmSize(name: string, version: string): Promise<PackageSize | null> {
  const res = await fetch(
    `https://registry.npmjs.org/${npmPath(name)}/${encodeURIComponent(version)}`,
    { headers: { Accept: "application/json" }, next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;
  const data = await res.json() as { dist?: { unpackedSize?: number } };
  const bytes = data?.dist?.unpackedSize;
  return bytes ? { bytes } : null;
}

async function pypiSize(name: string, version: string): Promise<PackageSize | null> {
  const res = await fetch(
    `https://pypi.org/pypi/${encodeURIComponent(name)}/${encodeURIComponent(version)}/json`,
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) return null;
  const data = await res.json() as { urls?: Array<{ size: number; packagetype: string }> };
  if (!data.urls?.length) return null;
  const wheel = data.urls.find((u) => u.packagetype === "bdist_wheel");
  const bytes = (wheel ?? data.urls[0]).size;
  return { bytes };
}

export async function fetchPackageSize(
  name: string,
  registry: "npm" | "pypi" | "maven",
  version: string
): Promise<PackageSize | null> {
  try {
    if (registry === "npm") return await npmSize(name, version);
    if (registry === "pypi") return await pypiSize(name, version);
    return null;
  } catch {
    return null;
  }
}
