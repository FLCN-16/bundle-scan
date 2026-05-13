# Bundle-Scan: Bundlephobia-style Web App with Security Scanning

## Context

The repo is a fresh `create-next-app` Next.js 16.2.6 starter (App Router, React 19.2, Tailwind v4, TypeScript). The user wants a Bundlephobia-style web app that:

1. Looks up a package + version, shows install size, min, min+gzip, dependency count, exports, similar info to bundlephobia.com.
2. Adds **security scanning** for that exact version using OSV.dev, NVD (NIST), and GitHub Advisory Database (GHSA).
3. Supports **npm, PyPI, and Maven Central** as registries.
4. Computes bundle size locally via **esbuild** in a route handler (no Bundlephobia proxy).
5. Is **stateless** (no DB/auth). Caches expensive lookups with Next 16 Cache Components (`'use cache'` + `cacheTag` + `cacheLife`).
6. Is **fully responsive** and follows Next.js 16 App Router structure rules.

Next.js 16 has breaking changes from common knowledge — async `params`/`searchParams`/`headers`/`cookies`, Turbopack default, `proxy.ts` (not `middleware.ts`), `cacheComponents` opt-in, route handlers cannot share segments with pages, etc. All new code adheres to these. See `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`.

## High-level architecture

```
app/
  layout.tsx                  (existing — keep, tweak metadata)
  page.tsx                    (rewrite — landing + search)
  globals.css                 (existing — extend tokens)
  [registry]/[...pkg]/page.tsx          server component, results page
  api/
    package/[registry]/route.ts          GET — registry metadata + version resolve
    bundle/[registry]/route.ts           POST — esbuild size computation (npm only)
    security/[registry]/route.ts         GET — OSV + GHSA + NVD merge
  components/                            client + server components
lib/
  registries/{npm,pypi,maven}.ts         registry adapters (resolve version, deps, tarball URL)
  bundle/esbuild-runner.ts               npm-only: install to tmp, bundle, measure gzip
  security/{osv,ghsa,nvd}.ts             advisory adapters
  security/aggregate.ts                  merge + de-dupe by CVE/GHSA id
  cache.ts                               cacheTag helpers
  types.ts
next.config.ts                           enable cacheComponents + remotePatterns
```

Route handlers live under `app/api/**/route.ts`. Page route segments live under `app/[registry]/[...pkg]/`. They never collide (different segments). All `params` are awaited.

## Feature breakdown

### 1. Landing page (`app/page.tsx`)
- Hero with search input (client component) — autocomplete using npm `https://registry.npmjs.org/-/v1/search?text=`, PyPI `https://pypi.org/search/?q=` (HTML — fall back to no autocomplete), Maven `https://search.maven.org/solrsearch/select?q=`.
- Registry switcher (npm / PyPI / Maven) — chip group, npm default.
- Recent / popular packages (static list, server component).
- Responsive: mobile-first Tailwind, `sm:` `md:` `lg:` breakpoints. Hero collapses to single column under `md`.

### 2. Results page (`app/[registry]/[...pkg]/page.tsx`)
Server component. `params` is `Promise<{ registry: string; pkg: string[] }>` — must `await`. `pkg` is a catch-all to support scoped names (`@scope/name`) and Maven `groupId/artifactId` form.

Layout (responsive grid, `grid-cols-1 lg:grid-cols-3`):
- **Left/main (lg:col-span-2)**:
  - Header: name, version selector (client), description, repo/homepage links, license.
  - **Bundle size card** — min, min+gzip, download time @ Slow 3G / Emerging 4G (math, no API). npm only; for PyPI/Maven show "size N/A — non-JS registry" with the install/wheel/jar size from registry metadata instead.
  - **Composition** — top dependencies by size (esbuild metafile) as a horizontal bar list.
  - **Exports / treeshakeability** — sideEffects flag, ESM availability, types. npm only.
  - **History** — last 5 versions sizes (sequential `<Suspense>` fetches).
- **Right (lg:col-span-1)**:
  - **Security panel** — count badges (Critical/High/Medium/Low), then per-advisory cards: id (GHSA-/CVE-), severity, summary, fixed-in versions, source (OSV / GHSA / NVD), link.
  - **Quick facts** — published, weekly downloads (npm only via api.npmjs.org), maintainers count.

Each major card is its own async server component wrapped in `<Suspense fallback={<Skeleton />}>` so slow lookups don't block paint (required by Cache Components for uncached work).

### 3. Registry adapters (`lib/registries/*.ts`)

Each exports the same shape:
```ts
interface RegistryAdapter {
  resolve(name: string, version?: string): Promise<PackageMeta>;
  listVersions(name: string): Promise<string[]>;
  ecosystem: 'npm' | 'PyPI' | 'Maven';      // OSV ecosystem name
}
```

- **npm**: `https://registry.npmjs.org/<name>` then `<name>/<version>`. Tarball URL from `dist.tarball`.
- **PyPI**: `https://pypi.org/pypi/<name>/json` and `/<version>/json`. Use `info.requires_dist`, wheel URL from `urls[]`.
- **Maven**: `https://search.maven.org/solrsearch/select?q=g:<g>+AND+a:<a>` for versions; POM at `https://repo1.maven.org/maven2/<g-slashed>/<a>/<v>/<a>-<v>.pom`. Parse with a tiny XML reader (no extra dep — regex POM `<version>` extraction is sufficient for v1).

All adapters use `'use cache'` + `cacheTag(\`registry:${eco}:${name}:${version}\`)` + `cacheLife('hours')`.

### 4. Bundle size computation (`lib/bundle/esbuild-runner.ts`)

npm only. Route handler `app/api/bundle/npm/route.ts` (POST `{name, version}`):
1. Create unique tmp dir under `os.tmpdir()`.
2. `npm install <name>@<version> --no-save --omit=dev --prefix <tmp>` via `child_process.spawn` (10 s timeout, kill tree).
3. Write `entry.js` containing `import * as m from '<name>'; console.log(m);`.
4. Run `esbuild` (already a peer-free dep we'll add) programmatically: `bundle: true, minify: true, format: 'esm', metafile: true, platform: 'browser', external: builtinModules`.
5. Gzip the output buffer with `node:zlib` `gzipSync` for the gzip number.
6. Read metafile to compute per-dep contribution.
7. `fs.rm(tmp, {recursive:true})` in `finally`.

New deps: `esbuild` (dev+runtime). Install size budget acceptable.

Wrap with `cacheTag(\`bundle:${name}:${version}\`)` + `cacheLife('weeks')` (immutable per version).

Error envelope: `{ ok:false, error: 'INSTALL_FAILED'|'BUNDLE_FAILED'|'TIMEOUT', detail }` — UI degrades gracefully.

### 5. Security aggregation (`lib/security/*.ts`)

- **OSV** (`osv.ts`) — `POST https://api.osv.dev/v1/query` body `{ package: { name, ecosystem }, version }`. Returns array of vulns with `id`, `aliases`, `severity[]`, `affected[].ranges`, `database_specific.severity`. No key.
- **GHSA** (`ghsa.ts`) — only when `ecosystem === 'npm'` (and PyPI/Maven supported by GHSA). GraphQL `securityVulnerabilities(ecosystem:NPM, package:"name")` filtered to versions matching the queried version range. Requires `GITHUB_TOKEN` env (document in README; gracefully skip when missing).
- **NVD** (`nvd.ts`) — `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=<name>&keywordExactMatch`. NVD has no package index, so we filter results by CPE match `cpe:2.3:a:*:<name>:<version>:*`. Best-effort — flag results as `source:'NVD'` and `confidence:'low'` in UI. Optional `NVD_API_KEY` env increases rate limit.
- **`aggregate.ts`** — merge by primary id, prefer OSV's `aliases[]` to dedupe (GHSA-… <-> CVE-…). Normalize severity to `critical|high|medium|low|unknown` from CVSS v3 score buckets (≥9, ≥7, ≥4, >0).

All three adapters fetch in parallel inside the `app/api/security/[registry]/route.ts` handler with `Promise.allSettled` so one failing source does not blank the panel. `cacheTag(\`sec:${eco}:${name}:${version}\`)` + `cacheLife('hours')` (advisories appear over time — re-check hourly).

### 6. Caching & revalidation

- `next.config.ts`: `cacheComponents: true`, `images.remotePatterns` for npm/GitHub avatars.
- All outbound `fetch` happens inside `'use cache'` async functions (Cache Components requirement).
- Tags allow targeted busting if needed later, e.g. `revalidateTag('sec:npm:lodash:4.17.21', 'max')`.

### 7. Responsive + a11y

- Tailwind v4 utility classes only; no fixed pixel widths; CSS grid + flex.
- Test breakpoints: 360, 640, 768, 1024, 1280.
- All interactive controls keyboard-reachable; results panel uses semantic `<section>`/`<h2>`; severity badges include sr-only text ("severity: high").
- Dark mode honored via existing `globals.css` CSS variables.

### 8. Error & loading states

- `app/[registry]/[...pkg]/loading.tsx` — top-level skeleton.
- `app/[registry]/[...pkg]/error.tsx` — client error boundary with retry.
- `app/not-found.tsx` — for unknown package.
- Per-card `<Suspense fallback={<Skeleton/>}>` so size and security stream independently.

## Files to create / modify

**Modify**
- `app/page.tsx` — replace CNA marketing with hero + search.
- `app/layout.tsx` — update `metadata` (title/description/og), keep fonts.
- `app/globals.css` — add severity color tokens.
- `next.config.ts` — `cacheComponents: true`, `images.remotePatterns`.
- `package.json` — add `esbuild`.

**Create**
- `app/components/SearchBar.tsx` (`'use client'`)
- `app/components/RegistrySwitcher.tsx` (`'use client'`)
- `app/components/SizeCard.tsx`, `SecurityPanel.tsx`, `CompositionCard.tsx`, `VersionPicker.tsx`, `Skeleton.tsx`, `SeverityBadge.tsx`
- `app/[registry]/[...pkg]/page.tsx`
- `app/[registry]/[...pkg]/loading.tsx`
- `app/[registry]/[...pkg]/error.tsx`
- `app/not-found.tsx`
- `app/api/package/[registry]/route.ts`
- `app/api/bundle/npm/route.ts`
- `app/api/security/[registry]/route.ts`
- `lib/registries/{npm,pypi,maven}.ts`
- `lib/bundle/esbuild-runner.ts`
- `lib/security/{osv,ghsa,nvd,aggregate}.ts`
- `lib/cache.ts`, `lib/types.ts`

## Next.js 16 rules being followed

- App Router only; no `pages/`. Route handlers in `route.ts`, never colocated with `page.tsx` at the same segment.
- All dynamic APIs awaited: `const { registry, pkg } = await params`.
- Cache Components on; every uncached `fetch` is wrapped in `'use cache'` helpers or rendered inside `<Suspense>`.
- `'use client'` pushed as deep as possible (only `SearchBar`, `RegistrySwitcher`, `VersionPicker`, `error.tsx`).
- No `middleware.ts`; if request rewriting is later needed, use `proxy.ts` (Node runtime).
- `next/image` uses `remotePatterns`, not deprecated `domains`.

## Verification

1. `pnpm install` — verify `esbuild` installs cleanly.
2. `pnpm dev` — open `http://localhost:3000`, search `react`, expect redirect to `/npm/react` showing min+gzip + 0 advisories.
3. Search `lodash@4.17.20` — expect at least one OSV advisory (CVE-2021-23337 prototype pollution); `lodash@4.17.21` — clean.
4. Switch registry to PyPI, search `urllib3@1.25.0` — expect OSV advisories; bundle card shows "size N/A — non-JS".
5. Switch to Maven, search `org.apache.logging.log4j/log4j-core@2.14.1` — expect Log4Shell advisories from OSV + NVD.
6. Resize browser to 360 px wide — layout collapses to single column, all controls reachable, no horizontal scroll.
7. Kill network mid-load — error boundary appears with retry; security panel still renders other sources via `Promise.allSettled`.
8. `pnpm build` — production build succeeds with Cache Components enabled (no "Uncached data accessed outside `<Suspense>`" errors).
9. Lighthouse on `/npm/react` mobile preset — perf ≥ 85, a11y ≥ 95.
