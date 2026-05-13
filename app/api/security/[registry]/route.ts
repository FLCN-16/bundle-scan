import { NextRequest, NextResponse } from "next/server";
import { aggregateSecurity } from "@/lib/security/aggregate";

const ECOSYSTEM_MAP: Record<string, string> = {
  npm: "npm",
  pypi: "PyPI",
  maven: "Maven",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registry: string }> }
) {
  const { registry } = await params;
  const { searchParams } = request.nextUrl;
  const name = searchParams.get("name");
  const version = searchParams.get("version");

  if (!name || !version) {
    return NextResponse.json({ error: "Missing name or version" }, { status: 400 });
  }

  const ecosystem = ECOSYSTEM_MAP[registry];
  if (!ecosystem) {
    return NextResponse.json({ error: `Unknown registry: ${registry}` }, { status: 400 });
  }

  try {
    const result = await aggregateSecurity(name, ecosystem, version);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
