import { put } from "@vercel/blob";
import { NextRequest } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: { id?: string; data?: unknown };
  try {
    body = (await request.json()) as { id?: string; data?: unknown };
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const { id, data } = body;
  if (!id || !UUID_RE.test(id) || !data) {
    return Response.json({ ok: false }, { status: 400 });
  }

  try {
    await put(`package-scans/${id}.json`, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
      cacheControlMaxAge: 86400,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
