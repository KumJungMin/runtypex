import ts from "typescript";

export function resolveTypeByName(
  program: ts.Program,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
  name: string
): ts.Type | null {
  // -1️⃣ Primitive type fallback
  const primitiveNames = ["string", "number", "boolean", "bigint", "symbol", "null", "undefined"];
  if (primitiveNames.includes(name)) {
    const map = {
      string: (checker as any).getStringType(),
      number: (checker as any).getNumberType(),
      boolean: (checker as any).getBooleanType(),
      bigint: (checker as any).getBigIntType(),
      symbol: (checker as any).getESSymbolType(),
      null: (checker as any).getNullType(),
      undefined: (checker as any).getUndefinedType(),
    } as const;

    return map[name as keyof typeof map];
  }

  // 2️⃣ Scan source files
  for (const file of program.getSourceFiles()) {
    const decl = _findLocalDeclaration(file, name);
    if (!decl) continue;

    // ✅ type, interface, enum, class
    if (
      ts.isInterfaceDeclaration(decl) ||
      ts.isClassDeclaration(decl) ||
      ts.isEnumDeclaration(decl)
    ) {
      if (decl.name) {
        const symbol = checker.getSymbolAtLocation(decl.name);
        if (symbol) return checker.getDeclaredTypeOfSymbol(symbol);
      }
    }

    if (ts.isTypeAliasDeclaration(decl)) {
      return checker.getTypeFromTypeNode(decl.type);
    }
  }

  // 3️⃣ Scope-based fallback
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