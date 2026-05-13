import type { BundleResponse } from "@/lib/types";

function formatBytes(bytes: number): { value: string; unit: string } {
  if (bytes < 1024) return { value: bytes.toFixed(0), unit: "B" };
  if (bytes < 1024 * 1024) return { value: (bytes / 1024).toFixed(1), unit: "kB" };
  return { value: (bytes / 1024 / 1024).toFixed(2), unit: "MB" };
}

function downloadTime(bytes: number, kbps: number): string {
  const secs = bytes / (kbps * 1024 / 8);
  if (secs < 1) return `${(secs * 1000).toFixed(0)} ms`;
  return `${secs.toFixed(1)} s`;
}

function SizeDisplay({ label, bytes }: { label: string; bytes: number }) {
  const { value, unit } = formatBytes(bytes);
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
        {value}
        <span className="text-lg ml-1 text-zinc-500">{unit}</span>
      </div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

export function SizeCard({ result }: { result: BundleResponse }) {
  if (!result.ok) {
    return (
      <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">
          Bundle Size
        </h2>
        <div className="text-zinc-500 text-sm">
          {result.error === "UNSUPPORTED"
            ? "Bundle analysis is only available for npm packages."
            : `Unable to compute bundle size: ${result.detail}`}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-6">
        Bundle Size
      </h2>
      <div className="flex flex-wrap justify-around gap-6 mb-6">
        <SizeDisplay label="Minified" bytes={result.minSize} />
        <SizeDisplay label="Minified + Gzipped" bytes={result.gzipSize} />
      </div>
      <div className="text-xs text-zinc-400 text-center space-x-4">
        <span>Slow 3G: {downloadTime(result.gzipSize, 50)}</span>
        <span>Emerging 4G: {downloadTime(result.gzipSize, 875)}</span>
      </div>
    </section>
  );
}

export function CompositionCard({
  composition,
  totalMin,
}: {
  composition: Array<{ name: string; bytes: number }>;
  totalMin: number;
}) {
  if (!composition.length) return null;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-4">
        Bundle Composition
      </h2>
      <ul className="space-y-2">
        {composition.map((dep) => {
          const pct = Math.min(100, (dep.bytes / totalMin) * 100);
          const { value, unit } = formatBytes(dep.bytes);
          return (
            <li key={dep.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[70%]">
                  {dep.name}
                </span>
                <span className="text-zinc-500 tabular-nums">
                  {value} {unit}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${pct}%` }}
                  aria-label={`${pct.toFixed(0)}% of bundle`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
