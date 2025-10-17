// @ts-ignore
import type { Plugin } from "vite";
import ts from "typescript";
import path from "node:path";
import { emitGuardFromType } from "../core/index";

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
  const prod = process.env.NODE_ENV === "production";

  return {
    name: "vite-plugin-runtypex",
    enforce: "pre",

    transform(code: string, id: string) {
      const isTS = id.endsWith(".ts") || id.endsWith(".tsx");
      const isTargetFunction = /make(?:Validate|Assert)</.test(code);
      if (!isTS || !isTargetFunction) return;

      const { program, checker } = _createProgramFor(id);
      const sf = program.getSourceFile(id);
      if (!sf) return;

      let mutated = code;

      // ② makeAssert<T>()
      mutated = mutated.replace(
        /makeAssert<\s*([^>]+)\s*>\s*\(\s*\)/g,
        (_m, typeName) =>
          _emitMakeAssert({ program, checker, sf, typeName, prod, removeInProd }) ?? _m
      );

      // ③ makeValidate<T>()
      mutated = mutated.replace(
        /makeValidate<\s*([^>]+)\s*>\s*\(\s*\)/g,
        (_m, typeName) =>
          _emitMakeValidate({ program, checker, sf, typeName, prod, removeInProd }) ?? _m
      );
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
  const checker = program.getTypeChecker();
  return { program, checker };
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

function _emitMakeValidate({
  program,
  checker,
  sf,
  typeName,
  prod,
  removeInProd,
}: any) {
  if (removeInProd && prod) return `((_)=>true)`;

  const type = _resolveTypeByName(program, sf, checker, typeName.trim());
  if (!type) return null;

  return emitGuardFromType(checker, type);
}

function _emitMakeAssert({
  program,
  checker,
  sf,
  typeName,
  prod,
  removeInProd,
}: any) {
  if (removeInProd && prod) return `((_)=>{})`;

  const type = _resolveTypeByName(program, sf, checker, typeName.trim());
  if (!type) return null;

  const guard = emitGuardFromType(checker, type);
  return `(function(){const G=${guard};return(i)=>{if(!G(i))throw new TypeError("[runtypex] Validation failed.");};})()`;
}

// ──────────────────────────────────────────────
// ③ Type Resolution (support interface/type/enum)
// ──────────────────────────────────────────────
function _resolveTypeByName(
  program: ts.Program,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
  name: string
): ts.Type | null {
  // scan all source files for local declaration
  for (const file of program.getSourceFiles()) {
    const decl = _findLocalDeclaration(file, name);
    if (!decl) continue;

    // interface / class / enum
    if (ts.isInterfaceDeclaration(decl) || ts.isClassDeclaration(decl) || ts.isEnumDeclaration(decl)) {
      // @ts-ignore
      const symbol = checker.getSymbolAtLocation(decl.name);
      if (symbol) return checker.getDeclaredTypeOfSymbol(symbol);
    }
    // type alias
    if (ts.isTypeAliasDeclaration(decl)) {
      return checker.getTypeFromTypeNode(decl.type);
    }
  }

  // Scope-based fallback
  const symbol = checker
    .getSymbolsInScope(sf, ts.SymbolFlags.Type | ts.SymbolFlags.Alias | ts.SymbolFlags.Interface)
    .find((s) => s.name === name);

  return symbol ? checker.getDeclaredTypeOfSymbol(symbol) : null;
}

function _findLocalDeclaration(sf: ts.SourceFile, name: string): ts.Node | undefined {
  let found: ts.Node | undefined;
  (function walk(node: ts.Node) {
    if (
      (ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isClassDeclaration(node)) &&
      (node as any).name?.text === name
    ) {
      found = node;
      return;
    }
    if (!found) node.forEachChild(walk);
  })(sf);
  return found;
}
