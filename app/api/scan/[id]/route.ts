import { list, del } from "@vercel/blob";
import { NextRequest } from "next/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ONE_DAY_MS = 86_400_000;

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return Response.json({ ok: false }, { status: 400 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[bundle-scan] BLOB_READ_WRITE_TOKEN is not set — blob read skipped");
    return Response.json({ ok: false, error: "blob_not_configured" }, { status: 503 });
  }

  try {
    const { blobs } = await list({ prefix: `package-scans/${id}.json`, limit: 1 });
    if (!blobs.length) {
      return Response.json({ ok: false, expired: false }, { status: 404 });
    }

    const res = await fetch(blobs[0].url);
    if (!res.ok) return Response.json({ ok: false }, { status: 404 });

    const data = (await res.json()) as { savedAt?: number };

    if (data.savedAt && Date.now() - data.savedAt > ONE_DAY_MS) {
      // auto-delete expired blobs at read time
      await del(blobs[0].url).catch(() => {});
      return Response.json({ ok: false, expired: true }, { status: 410 });
    }

    return Response.json({ ok: true, data });
  } catch (err) {
    console.error("[bundle-scan] blob list/fetch failed:", err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
