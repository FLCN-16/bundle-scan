# Contributing to Bundle Scan

Thanks for your interest in contributing! Bundle Scan is a tool for analyzing bundle size, security vulnerabilities, and dependency composition for npm, PyPI, and Maven packages.

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Local development

```bash
git clone https://github.com/FLCN-16/bundle-scan.git
cd bundle-scan
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## How to Contribute

### Reporting bugs

Open a [bug report](https://github.com/FLCN-16/bundle-scan/issues/new?template=bug_report.md). Include steps to reproduce, expected vs actual behavior, and your environment.

### Suggesting features

Open a [feature request](https://github.com/FLCN-16/bundle-scan/issues/new?template=feature_request.md). Explain the problem you're solving and your proposed solution.

### Submitting a pull request

1. Fork the repo and create a branch from `develop`:
   ```bash
   git checkout -b feat/your-feature develop
   ```
2. Make your changes. Keep commits focused and atomic.
3. Run lint before pushing:
   ```bash
   pnpm lint
   ```
4. Push your branch and open a PR against `develop` (not `main`).
5. Fill in the PR template and link any related issues.

### Branch naming

| Type      | Pattern                   |
| --------- | ------------------------- |
| Feature   | `feat/short-description`  |
| Bug fix   | `fix/short-description`   |
| Chore     | `chore/short-description` |
| Docs      | `docs/short-description`  |

## Code Style

- TypeScript everywhere — no `any` without a comment explaining why
- Tailwind CSS for styling
- Keep components small and co-located with their route when possible
- No unused imports or variables

## Adding a New Registry

The registries live in `lib/registries/`. Each registry module exports a consistent interface for fetching metadata and vulnerability data. Look at an existing registry (e.g. `npm.ts`) as a reference before adding a new one.

## Questions

Open a [GitHub Discussion](https://github.com/FLCN-16/bundle-scan/discussions) for anything that isn't a bug or feature request.
