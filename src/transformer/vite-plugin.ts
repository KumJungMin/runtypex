// @ts-ignore
import type { Plugin } from "vite";

import ts from "typescript";
import path from "node:path";
import { emitGuardFromType } from "../core";

/**
 * 🧩 vitePluginRuntypex
 *
 * A Vite plugin that performs **build-time** TypeScript type → runtime validation transformation.
 *
 * 📘 Purpose
 *  - Replace calls like:
 *      makeValidate<T>(), makeAssert<T>(), makeFallback<T>()
 *    with *inline JavaScript guard functions* derived from TypeScript types.
 *
 * 💡 Features
 *  - Works in both dev & build mode
 *  - Optional: remove validation code in production (`removeInProd`)
 *  - Compatible with Rollup / Webpack (via Vite plugin API)
 */
export default function vitePluginRuntypex(options?: { removeInProd?: boolean }): Plugin {
  const removeInProd = !!options?.removeInProd;
  const prod = process.env.NODE_ENV === "production";
  const tsconfigCache = new Map<string, ts.Program>();

  return {
    name: "vite-plugin-runtypex",
    enforce: "pre",

    /**
     * 🔍 Transform hook — runs before Vite compiles each .ts/.tsx file.
     */
    transform(code: string, id: string) {
      const isTS = id.endsWith(".ts") || id.endsWith(".tsx");
      if (!isTS) return;

      // Quick skip if no makeXxx<T> call exists
      if (!/makeValidate<|makeAssert<|makeFallback</.test(code)) return;

      let program: ts.Program;
      let checker: ts.TypeChecker;

      try {
        ({ program, checker } = _createProgramFor(id, tsconfigCache));
      } catch (err: any) {
        console.warn(`[runtypex] Failed to create TS program for ${id}\n`, err?.message ?? err);
        return null;
      }

      const sf = program.getSourceFile(id);
      if (!sf) return;

      let mutated = code;

      // ──────────────────────────────────────────────
      // 🔹 makeFallback<T>({ fallback })
      // ──────────────────────────────────────────────
      mutated = mutated.replace(
        /makeFallback<\s*([^>]+)\s*>\s*\(\s*({[\s\S]*?})\s*\)/g,
        (_m, typeName, argsText) =>
          _emitMakeFallback({ checker, sf, typeName, argsText, prod, removeInProd }) ?? _m
      );

      // 🔹 makeAssert<T>()
      mutated = mutated.replace(
        /makeAssert<\s*([^>]+)\s*>\s*\(\s*\)/g,
        (_m, typeName) =>
          _emitMakeAssert({ checker, sf, typeName, prod, removeInProd }) ?? _m
      );

      // 🔹 makeValidate<T>()
      mutated = mutated.replace(
        /makeValidate<\s*([^>]+)\s*>\s*\(\s*\)/g,
        (_m, typeName) =>
          _emitMakeValidate({ checker, sf, typeName, prod, removeInProd }) ?? _m
      );

      return mutated === code ? null : { code: mutated, map: null };
    },
  };
}

//
// ──────────────────────────────────────────────
// ① createProgram & TypeChecker
// ──────────────────────────────────────────────
function _createProgramFor(file: string, cache: Map<string, ts.Program>) {
  const tsconfig = _findNearestTsconfig(path.dirname(file));
  if (cache.has(tsconfig)) {
    const program = cache.get(tsconfig)!;
    return { program, checker: program.getTypeChecker() };
  }

  const cfg = ts.readConfigFile(tsconfig, ts.sys.readFile);
  if (cfg.error) {
    throw new Error(ts.flattenDiagnosticMessageText(cfg.error.messageText, "\n"));
  }

  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(tsconfig));
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  cache.set(tsconfig, program);

  return { program, checker: program.getTypeChecker() };
}

//
// ──────────────────────────────────────────────
// ② find nearest tsconfig.json
// ──────────────────────────────────────────────
function _findNearestTsconfig(startDir: string): string {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, "tsconfig.json");
    if (ts.sys.fileExists(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const fallback = path.join(process.cwd(), "tsconfig.json");
  if (ts.sys.fileExists(fallback)) return fallback;
  throw new Error("tsconfig.json not found.");
}

//
// ──────────────────────────────────────────────
// ③ resolve type by name (interface / type / enum)
// ──────────────────────────────────────────────
function _resolveTypeByName(sf: ts.SourceFile, checker: ts.TypeChecker, name: string): ts.Type | null {
  const decl = _findLocalDecl(sf, name);
  if (decl) {
    const typeNode = ts.isTypeAliasDeclaration(decl)
      ? decl.type
      : ts.factory.createTypeReferenceNode((decl as any).name.text, undefined);
    return checker.getTypeFromTypeNode(typeNode);
  }

  const sym = checker
    .getSymbolsInScope(sf, ts.SymbolFlags.Type | ts.SymbolFlags.Alias)
    .find((s) => s.name === name);

  return sym ? checker.getDeclaredTypeOfSymbol(sym) : null;
}

function _findLocalDecl(sf: ts.SourceFile, name: string): ts.Node | undefined {
  let found: ts.Node | undefined;
  (function walk(n: ts.Node) {
    if (
      (ts.isInterfaceDeclaration(n) ||
        ts.isTypeAliasDeclaration(n) ||
        ts.isEnumDeclaration(n)) &&
      (n as any).name?.text === name
    ) {
      found = n;
      return;
    }
    if (!found) n.forEachChild(walk);
  })(sf);
  return found;
}

//
// ──────────────────────────────────────────────
// ④ makeValidate<T>() → (input) => boolean
// ──────────────────────────────────────────────
function _emitMakeValidate({
  checker,
  sf,
  typeName,
  prod,
  removeInProd,
}: {
  checker: ts.TypeChecker;
  sf: ts.SourceFile;
  typeName: string;
  prod: boolean;
  removeInProd: boolean;
}) {
  if (removeInProd && prod) return `((_)=>true)`;
  const type = _resolveTypeByName(sf, checker, typeName.trim());
  if (!type) {
    console.warn(`[runtypex] Type not found: ${typeName}`);
    return null;
  }
  return emitGuardFromType(checker, type);
}

//
// ──────────────────────────────────────────────
// ⑤ makeAssert<T>() → (input) => throw if invalid
// ──────────────────────────────────────────────
function _emitMakeAssert({
  checker,
  sf,
  typeName,
  prod,
  removeInProd,
}: {
  checker: ts.TypeChecker;
  sf: ts.SourceFile;
  typeName: string;
  prod: boolean;
  removeInProd: boolean;
}) {
  if (removeInProd && prod) return `((_)=>{})`;
  const type = _resolveTypeByName(sf, checker, typeName.trim());
  if (!type) {
    console.warn(`[runtypex] Type not found: ${typeName}`);
    return null;
  }

  const guard = emitGuardFromType(checker, type);
  return `(function(){const G=${guard};return(i)=>{if(!G(i))throw new TypeError("[runtypex] Validation failed for ${typeName}");};})()`;
}

//
// ──────────────────────────────────────────────
// ⑥ makeFallback<T>({ fallback })
// ──────────────────────────────────────────────
function _emitMakeFallback({
  checker,
  sf,
  typeName,
  argsText,
  prod,
  removeInProd,
}: {
  checker: ts.TypeChecker;
  sf: ts.SourceFile;
  typeName: string;
  argsText: string;
  prod: boolean;
  removeInProd: boolean;
}) {
  const fallbackExpr = _extractFallbackExpr(argsText);
  if (removeInProd && prod) {
    return `(function(){const F=${fallbackExpr};return(_)=>F;})()`;
  }

  const type = _resolveTypeByName(sf, checker, typeName.trim());
  if (!type) {
    console.warn(`[runtypex] Type not found: ${typeName}`);
    return null;
  }

  const guard = emitGuardFromType(checker, type);
  return `(function(){const G=${guard};const F=${fallbackExpr};return(i)=>G(i)?i:F;})()`;
}

//
// ──────────────────────────────────────────────
// ⑦ Extract fallback expression
// ──────────────────────────────────────────────
function _extractFallbackExpr(objLiteralText: string): string {
  const m = objLiteralText.match(/fallback\s*:\s*([\s\S]*?)\s*(?:,|$)/m);
  return m ? m[1].trim() : "undefined";
}
