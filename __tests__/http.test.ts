import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry, fetchWithTimeout } from "../lib/http";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("resilient fetch helpers", () => {
  it("retries a transient upstream failure once", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const response = await fetchWithRetry("https://example.test", {}, { retryDelayMs: 0 });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts a request that exceeds its deadline", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));

    const request = fetchWithTimeout("https://example.test", {}, 25);
    const rejected = expect(request).rejects.toThrow("aborted");
    await vi.advanceTimersByTimeAsync(25);

    await rejected;
  });
});
