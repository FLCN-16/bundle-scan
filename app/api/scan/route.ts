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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[bundle-scan] BLOB_READ_WRITE_TOKEN is not set — blob save skipped");
    return Response.json({ ok: false, error: "blob_not_configured" }, { status: 503 });
  }

  try {
    await put(`package-scans/${id}.json`, JSON.stringify(data), {
      access: "public",
      contentType: "application/json",
      cacheControlMaxAge: 86400,
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[bundle-scan] blob put failed:", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
