import { listPypiVersions } from "@/lib/registries/pypi";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) return NextResponse.json({ versions: [] }, { status: 400 });

  try {
    const versions = await listPypiVersions(name);
    return NextResponse.json({ versions }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch {
    return NextResponse.json({ versions: [] });
  }
}
