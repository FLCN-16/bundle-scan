export type ExtendedRequestInit = RequestInit & {
  next?: { revalidate?: number; tags?: string[] };
};

interface RetryOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: ExtendedRequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init.signal;
  const forwardAbort = () => controller.abort(externalSignal?.reason);
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) forwardAbort();
    else externalSignal.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener("abort", forwardAbort);
  }
}

/** Fetch with a deadline and one bounded retry for transient upstream failures. */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: ExtendedRequestInit = {},
  { timeoutMs = 10_000, retries = 1, retryDelayMs = 150 }: RetryOptions = {},
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(input, init, timeoutMs);
      if (!retryableStatus(response.status) || attempt === retries) return response;
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
    }

    if (retryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }

  throw lastError instanceof Error ? lastError : new Error("Request failed");
}
