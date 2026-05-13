import { NextRequest, NextResponse } from "next/server";

export interface LangUsageResult {
  languages: Array<{ name: string; bytes: number; color: string }>;
  total: number;
  repoUrl: string;
}

// Subset of GitHub's Linguist colors
const LANG_COLORS: Record<string, string> = {
  TypeScript:  "#3178c6",
  JavaScript:  "#f1e05a",
  Python:      "#3572a5",
  Rust:        "#dea584",
  Go:          "#00add8",
  Java:        "#b07219",
  "C++":       "#f34b7d",
  C:           "#555555",
  "C#":        "#178600",
  Ruby:        "#701516",
  PHP:         "#4f5d95",
  Swift:       "#f05138",
  Kotlin:      "#a97bff",
  Scala:       "#c22d40",
  Dart:        "#00b4ab",
  CSS:         "#563d7c",
  SCSS:        "#c6538c",
  HTML:        "#e34c26",
  Vue:         "#41b883",
  Svelte:      "#ff3e00",
  Shell:       "#89e051",
  Dockerfile:  "#384d54",
  Makefile:    "#427819",
  Lua:         "#000080",
  Elixir:      "#6e4a7e",
  Haskell:     "#5e5086",
  Clojure:     "#db5855",
  "Objective-C": "#438eff",
  Nix:         "#7e7eff",
};

function githubRepoFromUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url.replace(/^git\+/, "").replace(/\.git$/, ""));
    if (!u.hostname.includes("github.com")) return null;
    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const repoUrl = request.nextUrl.searchParams.get("repo");
  if (!repoUrl) {
    return NextResponse.json({ error: "Missing repo" }, { status: 400 });
  }

  const parsed = githubRepoFromUrl(repoUrl);
  if (!parsed) {
    return NextResponse.json({ error: "Not a GitHub URL" }, { status: 422 });
  }

  const { owner, repo } = parsed;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "bundle-scan/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`,
      { headers, next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `GitHub API ${res.status}` }, { status: res.status });
    }

    const raw = (await res.json()) as Record<string, number>;
    const total = Object.values(raw).reduce((s, n) => s + n, 0);

    const languages = Object.entries(raw)
      .sort(([, a], [, b]) => b - a)
      .map(([name, bytes]) => ({
        name,
        bytes,
        color: LANG_COLORS[name] ?? "#8b949e",
      }));

    return NextResponse.json({ languages, total, repoUrl } satisfies LangUsageResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
