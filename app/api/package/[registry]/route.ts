import { NextRequest, NextResponse } from "next/server";
import { resolveNpm } from "@/lib/registries/npm";
import { resolvePypi } from "@/lib/registries/pypi";
import { resolveMaven } from "@/lib/registries/maven";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ registry: string }> }
) {
  const { registry } = await params;
  const { searchParams } = request.nextUrl;
  const name = searchParams.get("name");
  const version = searchParams.get("version") ?? undefined;

  if (!name) {
    return NextResponse.json({ error: "Missing name parameter" }, { status: 400 });
  }

  try {
    let meta;
    if (registry === "npm") {
      meta = await resolveNpm(name, version);
    } else if (registry === "pypi") {
      meta = await resolvePypi(name, version);
    } else if (registry === "maven") {
      meta = await resolveMaven(name, version);
    } else {
      return NextResponse.json({ error: `Unknown registry: ${registry}` }, { status: 400 });
    }
    return NextResponse.json(meta);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}
