import { NextRequest, NextResponse } from "next/server";
import { computeBundle } from "@/lib/bundle/esbuild-runner";

export async function POST(request: NextRequest) {
  let body: { name?: string; version?: string };
  try {
    body = (await request.json()) as { name?: string; version?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "BUNDLE_FAILED", detail: "Invalid JSON" }, { status: 400 });
  }

  const { name, version } = body;
  if (!name || !version) {
    return NextResponse.json({ ok: false, error: "BUNDLE_FAILED", detail: "Missing name or version" }, { status: 400 });
  }

  // Reject non-registry specifiers (file:, git+, github:, etc.) that npm would
  // resolve outside the registry — these bypass --ignore-scripts protections.
  const NPM_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  const SEMVER_RE = /^[0-9a-zA-Z\-+.*^~<>=|, ]+$/;
  if (!NPM_NAME_RE.test(name) || !SEMVER_RE.test(version) || version.length > 64) {
    return NextResponse.json({ ok: false, error: "BUNDLE_FAILED", detail: "Invalid package name or version" }, { status: 400 });
  }

  const result = await computeBundle(name, version);
  return NextResponse.json(result);
}
