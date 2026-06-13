// @ts-ignore
import type { Plugin } from "vite";
import ts from "typescript";
import path from "node:path";
import tsTransformer from "./ts-transformer.js";

/**
 * 🧩 vitePluginRuntypex
 * A Vite plugin that performs build-time type → runtime validation transformation.
 *
 * 📘 Purpose
 *  - Replace calls like:
 *      makeValidate<T>(), makeAssert<T>()
 *    with *inline JavaScript guard functions* derived from TypeScript types.
 *
 * 💡 Features
 *  - Works in both dev & build mode
 *  - Optional: remove validation code in production (`removeInProd`)
 *  - Compatible with Rollup / Webpack (via Vite plugin API)
 */
export default function vitePluginRuntypex(options?: { removeInProd?: boolean }): Plugin {
  const removeInProd = !!options?.removeInProd;

  return {
    name: "vite-plugin-runtypex",
    enforce: "pre",

    transform(code: string, id: string) {
      const isTS = id.endsWith(".ts") || id.endsWith(".tsx");
      const isTargetFunction = /make(?:Validate|Assert|Mapper)</.test(code);
      if (!isTS || !isTargetFunction) return;

      const { program } = _createProgramFor(id);
      const sf = program.getSourceFile(id);
      if (!sf) return;

      const result = ts.transform(sf, [tsTransformer({ program, removeInProd })]);
      const mutated = ts.createPrinter().printFile(result.transformed[0] as ts.SourceFile);
      result.dispose();

      return mutated === code ? null : { code: mutated, map: null };
    },
  };
}

// ──────────────────────────────────────────────
// ① createProgram & TypeChecker
// ──────────────────────────────────────────────
function _createProgramFor(file: string) {
  const tsconfig = _findNearestTsconfig(path.dirname(file));
  const cfg = ts.readConfigFile(tsconfig, ts.sys.readFile);
  if (cfg.error) {
    throw new Error(ts.flattenDiagnosticMessageText(cfg.error.messageText, "\n"));
  }

  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(tsconfig));
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  return { program };
}

function _findNearestTsconfig(start: string): string {
  let dir = start;
  while (true) {
    const candidate = path.join(dir, "tsconfig.json");
    if (ts.sys.fileExists(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const fallback = path.join(process.cwd(), "tsconfig.json");
  if (ts.sys.fileExists(fallback)) return fallback;
  throw new Error("tsconfig.json not found");
}
