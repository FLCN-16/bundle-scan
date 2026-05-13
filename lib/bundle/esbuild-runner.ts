import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { existsSync } from "node:fs";
import * as zlib from "node:zlib";
import { spawn } from "node:child_process";
import { build } from "esbuild";
import type { BundleResponse } from "@/lib/types";
import { builtinModules } from "node:module";

function spawnAsync(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeout: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd,
      stdio: "pipe",
      env: { ...process.env, npm_config_fund: "false", npm_config_audit: "false" },
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("TIMEOUT"));
    }, opts.timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Exit code ${code}`));
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function computeBundle(
  name: string,
  version: string
): Promise<BundleResponse> {
  const tmpDir = path.join(os.tmpdir(), `bundle-scan-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  try {
    await fs.mkdir(tmpDir, { recursive: true });

    // Install the package
    const pkg = `${name}@${version}`;
    try {
      await spawnAsync(
        "npm",
        ["install", pkg, "--no-save", "--omit=dev", "--prefer-offline", "--no-package-lock", "--ignore-scripts"],
        { cwd: tmpDir, timeout: 30_000 }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "TIMEOUT") return { ok: false, error: "TIMEOUT", detail: "npm install timed out" };
      return { ok: false, error: "INSTALL_FAILED", detail: msg };
    }

    // Check package was installed
    const pkgDir = path.join(tmpDir, "node_modules", name.replace(/\//g, path.sep));
    if (!existsSync(pkgDir)) {
      return { ok: false, error: "INSTALL_FAILED", detail: "Package directory not found after install" };
    }

    // Write entry point
    const entryPath = path.join(tmpDir, "entry.js");
    await fs.writeFile(entryPath, `export * from ${JSON.stringify(name)};\n`);

    // Run esbuild
    let result;
    try {
      result = await build({
        entryPoints: [entryPath],
        bundle: true,
        minify: true,
        format: "esm",
        platform: "browser",
        metafile: true,
        write: false,
        external: [...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
        define: {
          "process.env.NODE_ENV": '"production"',
        },
        logLevel: "silent",
        absWorkingDir: tmpDir,
        nodePaths: [path.join(tmpDir, "node_modules")],
      });
    } catch (err: unknown) {
      return { ok: false, error: "BUNDLE_FAILED", detail: String(err) };
    }

    const output = result.outputFiles?.[0];
    if (!output) return { ok: false, error: "BUNDLE_FAILED", detail: "No output from esbuild" };

    const minSize = output.contents.length;
    const gzipSize = zlib.gzipSync(output.contents).length;

    // Compute composition from metafile
    const inputs = result.metafile?.inputs ?? {};
    const composition: Array<{ name: string; bytes: number }> = [];
    const moduleMap = new Map<string, number>();

    for (const [filePath, data] of Object.entries(inputs)) {
      if (!filePath.includes("node_modules")) continue;
      const parts = filePath.split("node_modules/");
      const rest = parts[parts.length - 1];
      const segments = rest.split("/");
      const pkgName = segments[0].startsWith("@")
        ? `${segments[0]}/${segments[1]}`
        : segments[0];
      if (!pkgName) continue;
      moduleMap.set(pkgName, (moduleMap.get(pkgName) ?? 0) + (data.bytes ?? 0));
    }

    for (const [pkgName, bytes] of moduleMap) {
      composition.push({ name: pkgName, bytes });
    }
    composition.sort((a, b) => b.bytes - a.bytes);

    return { ok: true, minSize, gzipSize, composition: composition.slice(0, 10) };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
