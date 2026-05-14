export type Registry = "npm" | "pypi" | "maven";

export interface PackageMeta {
  name: string;
  version: string;
  description: string;
  license: string;
  homepage?: string;
  repository?: string;
  ecosystem: "npm" | "PyPI" | "Maven";
  publishedAt?: string;
  weeklyDownloads?: number;
  maintainersCount?: number;
  allVersions: string[];
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  sideEffects?: boolean | string[];
  hasTypes?: boolean;
  hasEsm?: boolean;
  tarballUrl?: string;
  distSizes?: Array<{ filename: string; packagetype: string; size: number; url: string }>;
}

export interface BundleResult {
  ok: true;
  minSize: number;
  gzipSize: number;
  composition: Array<{ name: string; bytes: number; version?: string }>;
}

export interface BundleError {
  ok: false;
  error: "INSTALL_FAILED" | "BUNDLE_FAILED" | "TIMEOUT" | "UNSUPPORTED";
  detail: string;
}

export type BundleResponse = BundleResult | BundleError;

export type Severity = "critical" | "high" | "medium" | "low" | "unknown";

export interface Advisory {
  id: string;
  aliases: string[];
  severity: Severity;
  summary: string;
  details?: string;
  fixedVersions: string[];
  source: "OSV" | "GHSA" | "NVD";
  confidence: "high" | "low";
  url?: string;
  publishedAt?: string;
}

export interface SecurityResult {
  advisories: Advisory[];
  sources: { osv: boolean; ghsa: boolean; nvd: boolean };
  scannedAt: string;
}
