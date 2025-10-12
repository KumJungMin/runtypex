import ts from "typescript";
import { GenContext } from "../src/core/index";

// export function createCtxAndType(code: string, typeName: string) {
//   const fileName = "virtual.ts";
//   const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.ESNext, true);

//   const host = ts.createCompilerHost({ target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext });
//   const origGetSourceFile = host.getSourceFile.bind(host);
//   host.getSourceFile = (f, ...rest) => (f === fileName ? sourceFile : origGetSourceFile(f, ...rest));
//   host.writeFile = () => {};

//   const program = ts.createProgram({ rootNames: [fileName], options: {}, host });
//   const checker = program.getTypeChecker();

//   const symbol = checker
//     .getSymbolsInScope(sourceFile, ts.SymbolFlags.Type | ts.SymbolFlags.Alias)
//     .find((s) => s.name === typeName);
//   if (!symbol) throw new Error(`Type ${typeName} not found`);

//   const type = checker.getDeclaredTypeOfSymbol(symbol);
//   const ctx = new GenContext(checker);
//   return { ctx, type };
// }
export function createCtxAndType(code: string, typeName: string) {
  const fileName = "virtual.ts";
  const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.ESNext, true);

  // Custom CompilerHost for in-memory compilation
  const host = ts.createCompilerHost({ target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext });
  const origGetSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (f, ...rest) => (f === fileName ? sourceFile : origGetSourceFile(f, ...rest));
  host.writeFile = () => {};

  const program = ts.createProgram({ rootNames: [fileName], options: {}, host });
  const checker = program.getTypeChecker();

  const symbol = checker
    .getSymbolsInScope(sourceFile, ts.SymbolFlags.Type | ts.SymbolFlags.Alias | ts.SymbolFlags.Interface)
    .find((s) => s.name === typeName);
  if (!symbol) throw new Error(`Type ${typeName} not found`);

  const type = checker.getDeclaredTypeOfSymbol(symbol);
  const ctx = new GenContext(checker);
  return { ctx, type, checker };
}



export function norm(s: string) {
  return s.replace(/\s+/g, "");
}