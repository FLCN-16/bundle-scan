import { NextRequest } from "next/server";
import { computeBundle } from "@/lib/bundle/esbuild-runner";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { name?: string; version?: string };
  try {
    body = (await request.json()) as { name?: string; version?: string };
  } catch {
    return Response.json({ ok: false, error: "BUNDLE_FAILED", detail: "Invalid JSON" }, { status: 400 });
  }

  const { name, version } = body;
  if (!name || !version) {
    return Response.json({ ok: false, error: "BUNDLE_FAILED", detail: "Missing name or version" }, { status: 400 });
  }

  const NPM_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  const SEMVER_RE = /^[0-9a-zA-Z\-+.*^~<>=|, ]+$/;
  if (!NPM_NAME_RE.test(name) || !SEMVER_RE.test(version) || version.length > 64) {
    return Response.json({ ok: false, error: "BUNDLE_FAILED", detail: "Invalid package name or version" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

      try {
        const result = await computeBundle(name, version, (phase) =>
          send({ type: "progress", phase })
        );
        send({ type: "result", data: result });
      } catch {
        send({ type: "result", data: { ok: false, error: "BUNDLE_FAILED", detail: "Internal error" } });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
