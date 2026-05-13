# Bundle Scan

> Bundle size, security vulnerabilities, and dependency composition — for any package, any version.

Bundle Scan analyzes npm, PyPI, and Maven packages and shows you:

- **Bundle size** — minified + gzip, computed with esbuild, with per-dependency breakdown
- **Security vulnerabilities** — version-specific CVE lookup across OSV.dev, GitHub Advisory DB, and NVD
- **Fast & cached** — results cached per version; analysis streams in client-side

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [Tailwind CSS v4](https://tailwindcss.com)
- [esbuild](https://esbuild.github.io) for bundle analysis
- [OSV.dev](https://osv.dev) · [GitHub Advisory DB](https://github.com/advisories) · [NVD](https://nvd.nist.gov) for CVE data

## Getting started

### Prerequisites

- Node.js 20+
- pnpm 9+

### Run locally

```bash
git clone https://github.com/FLCN-16/bundle-scan.git
cd bundle-scan
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for production

```bash
pnpm build
pnpm start
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.

- [Report a bug](https://github.com/FLCN-16/bundle-scan/issues/new?template=bug_report.md)
- [Request a feature](https://github.com/FLCN-16/bundle-scan/issues/new?template=feature_request.md)
- [Join a discussion](https://github.com/FLCN-16/bundle-scan/discussions)

## Security

To report a security vulnerability, see [SECURITY.md](SECURITY.md). Please do not open a public issue.

## License

[MIT](LICENSE) © 2026 [The Falcon](https://thefalcon.dev)
