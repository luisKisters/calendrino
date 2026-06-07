// @vitest-environment node
//
// Regression guard for ERR_MODULE_NOT_FOUND on Vercel.
//
// The serverless functions in api/ are compiled to plain .js and executed by
// Node's *native* ESM loader, which — unlike Vite/esbuild's bundler resolution
// used by Vitest and the frontend — REQUIRES an explicit file extension on every
// relative import. An extensionless `import "../src/lib/aiCore"` type-checks,
// passes every unit test, and bundles fine, yet crashes the deployed function at
// module-load time with:
//
//   Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/var/task/src/lib/aiCore'
//
// Nothing in the bundler-resolved test suite can catch that, so we assert it
// statically: walk the import graph reachable from each api/ entrypoint and
// require every relative specifier to carry a runtime-resolvable extension.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const apiDir = resolve(repoRoot, "api");

// Extensions Node's ESM loader can resolve without a bundler.
const RUNTIME_EXT = /\.(js|mjs|cjs|json|node)$/;
// Capture specifiers from `import x from "…"`, `import "…"`, `export … from "…"`,
// and dynamic `import("…")`.
const SPECIFIER_RE = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g;

/** Serverless functions Vercel deploys: every non-test .ts file in api/. */
function apiEntrypoints(): string[] {
  return readdirSync(apiDir)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => resolve(apiDir, f));
}

function relativeSpecifiers(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(SPECIFIER_RE)) {
    if (match[1].startsWith(".")) out.push(match[1]);
  }
  return out;
}

/** Map a (now extension-ful) specifier back to its TypeScript source on disk. */
function resolveToSource(fromFile: string, specifier: string): string | null {
  const abs = resolve(dirname(fromFile), specifier);
  const candidates = [
    abs,
    abs.replace(/\.(js|mjs|cjs)$/, ".ts"),
    abs.replace(/\.(js|mjs|cjs)$/, ".tsx"),
    `${abs}.ts`,
    `${abs}.tsx`,
    resolve(abs, "index.ts"),
    resolve(abs, "index.tsx"),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

describe("api/ serverless functions resolve under Node ESM", () => {
  it("has at least one api entrypoint to check", () => {
    expect(apiEntrypoints().length).toBeGreaterThan(0);
  });

  it("every relative import in the deployed module graph carries an explicit extension", () => {
    const missingExtension: string[] = [];
    const unresolved: string[] = [];
    const visited = new Set<string>();

    const walk = (file: string) => {
      if (visited.has(file)) return;
      visited.add(file);
      const source = readFileSync(file, "utf8");
      const rel = (p: string) => p.replace(`${repoRoot}/`, "");
      for (const specifier of relativeSpecifiers(source)) {
        if (!RUNTIME_EXT.test(specifier)) {
          missingExtension.push(`${rel(file)} → "${specifier}"`);
          continue;
        }
        const target = resolveToSource(file, specifier);
        if (!target) {
          unresolved.push(`${rel(file)} → "${specifier}"`);
          continue;
        }
        if (/\.tsx?$/.test(target)) walk(target);
      }
    };

    for (const entry of apiEntrypoints()) walk(entry);

    expect(missingExtension, "extensionless relative imports break Node ESM on Vercel").toEqual([]);
    expect(unresolved, "relative imports that resolve to no source file").toEqual([]);
  });
});
