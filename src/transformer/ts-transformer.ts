import ts from "typescript";
import { emitGuardFromType } from "../core/index";

/**
 * 🧩 tsTransformer
 * TypeScript custom transformer (BEFORE) factory.
 *
 * 📘 Usage (ts-loader / ttypescript):
 * ```ts
 * getCustomTransformers: (program) => ({
 *   before: [ tsTransformer({ program, removeInProd: true }) ]
 * })
 * ```
 *
 * 🧠 Purpose:
 *  - Replace makeValidate<T>(), makeAssert<T>() calls
 *    with *pre-generated runtime validation code* derived from T.
 *
 * 💡 Effect:
 *   ✅ No reflection or runtime type parsing
 *   ✅ Validation logic embedded at build-time
 *   ✅ Optionally removed in production builds
 */
export default function tsTransformer(options: { program: ts.Program; removeInProd?: boolean }) {
  const { program } = options;
  const checker = options.program.getTypeChecker();
  const removeInProd = !!options.removeInProd;
  const prod = process.env.NODE_ENV === "production";

  return (context: ts.TransformationContext) => {
    const visit: ts.Visitor = (node: ts.Node): ts.Node => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const targetFunctions = ["makeValidate", "makeAssert"];

        if (targetFunctions.includes(name) && node.typeArguments?.length) {
          const typeNode = node.typeArguments[0];
          const typeName = typeNode.getText();
          const type = _resolveTypeByName(program, node.getSourceFile(), checker, typeName);

          if (!type) return node;

          const isRemovedInProd = removeInProd && prod;
          switch (name) {
            case "makeValidate":
              return _emitMakeValidate(checker, type, isRemovedInProd);
            case "makeAssert":
              return _emitMakeAssert(checker, type, isRemovedInProd);
          }
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sf: ts.SourceFile) => ts.visitNode(sf, visit);
  };
}


function _resolveTypeByName(
  program: ts.Program,
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
  name: string
): ts.Type | null {
   // 1️⃣ <string|number|boolean|null|undefined>
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

  // 2️⃣ <Type|Interface|Enum> declared in the same file or other files
  for (const file of program.getSourceFiles()) {
    const decl = _findLocalDeclaration(file, name);
    if (!decl) continue;
    if (ts.isInterfaceDeclaration(decl) || ts.isClassDeclaration(decl) || ts.isEnumDeclaration(decl)) {
      const symbol = decl.name ? checker.getSymbolAtLocation(decl.name) : null;
      if (symbol) return checker.getDeclaredTypeOfSymbol(symbol);
    }
    if (ts.isTypeAliasDeclaration(decl)) {
      return checker.getTypeFromTypeNode(decl.type);
    }
  }
  // 3️⃣ <Type|Interface|Enum> imported from other modules
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

function _emitMakeValidate(checker: ts.TypeChecker, type: ts.Type, isRemovedInProd: boolean): ts.Identifier {
  const guard = isRemovedInProd ? "((_)=>true)" : emitGuardFromType(checker, type); 

  return ts.factory.createIdentifier(guard) as any;
}

function _emitMakeAssert(checker: ts.TypeChecker, type: ts.Type, isRemovedInProd: boolean): ts.Identifier {
  const guard = isRemovedInProd ? "((_)=>{})" : emitGuardFromType(checker, type);
  const txt = `(function(){const G=${guard};return(i)=>{if(!G(i))throw new TypeError("[runtypex] Validation failed.");};})()`;
  
  return ts.factory.createIdentifier(txt) as any;
}