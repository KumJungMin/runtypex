import ts from "typescript";
import { emitGuardFromType } from "../core";

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
 *  - Replace makeValidate<T>(), makeAssert<T>(), makeFallback<T>() calls
 *    with *pre-generated runtime validation code* derived from T.
 *
 * 💡 Effect:
 *   ✅ No reflection or runtime type parsing
 *   ✅ Validation logic embedded at build-time
 *   ✅ Optionally removed in production builds
 */
export default function tsTransformer(options: { program: ts.Program; removeInProd?: boolean }) {
  const checker = options.program.getTypeChecker();
  const removeInProd = !!options.removeInProd;
  const prod = process.env.NODE_ENV === "production";

  /** AST Visitor — traverses and transforms relevant function calls */
  return (context: ts.TransformationContext) => {
    const visit: ts.Visitor = (node: ts.Node): ts.Node => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const targetFunctions = ["makeValidate", "makeAssert", "makeFallback"];

        if (targetFunctions.includes(name) && node.typeArguments?.length) {
          const typeNode = node.typeArguments[0]; // Extract T from makeX<T>()
          const type = checker.getTypeFromTypeNode(typeNode); // Resolve T to ts.Type
          const isRemovedInProd = removeInProd && prod;

          switch (name) {
            case "makeValidate":
              return _emitMakeValidate({ checker, type, isRemovedInProd });
            case "makeAssert":
              return _emitMakeAssert({ checker, type, isRemovedInProd });
            case "makeFallback":
              return _emitMakeFallback({ checker, type, node, isRemovedInProd });
          }
        }
      }
      return ts.visitEachChild(node, visit, context);
    };

    return (sf: ts.SourceFile) => ts.visitNode(sf, visit);
  };
}

//
// ────────────────────────────────────────────────────────────────
// 🔹 makeValidate<T>() → (input) => boolean
// ────────────────────────────────────────────────────────────────
function _emitMakeValidate({
  checker,
  type,
  isRemovedInProd,
}: {
  checker: ts.TypeChecker;
  type: ts.Type;
  isRemovedInProd: boolean;
}): ts.Expression {
  if (isRemovedInProd) {
    return ts.factory.createIdentifier("((_)=>true)");
  }
  const guard = emitGuardFromType(checker, type);
  return ts.factory.createIdentifier(guard);
}

//
// ────────────────────────────────────────────────────────────────
// 🔹 makeAssert<T>() → (input) => { throw if invalid }
// ────────────────────────────────────────────────────────────────
function _emitMakeAssert({
  checker,
  type,
  isRemovedInProd,
}: {
  checker: ts.TypeChecker;
  type: ts.Type;
  isRemovedInProd: boolean;
}): ts.Expression {
  if (isRemovedInProd) {
    return ts.factory.createIdentifier("((_)=>{})");
  }

  const guard = emitGuardFromType(checker, type);
  const fn = [
    "(function(){",
    `  const G=${guard};`,
    "  return (i)=>{",
    '    if(!G(i)) throw new TypeError("[runtypex] Validation failed.");',
    "  };",
    "})()",
  ].join("\n");

  return ts.factory.createIdentifier(fn);
}

//
// ────────────────────────────────────────────────────────────────
// 🔹 makeFallback<T>({ fallback: ... })
//     → (input) => G(input) ? input : fallback
// ────────────────────────────────────────────────────────────────
function _emitMakeFallback({
  checker,
  type,
  node,
  isRemovedInProd,
}: {
  checker: ts.TypeChecker;
  type: ts.Type;
  node: ts.CallExpression;
  isRemovedInProd: boolean;
}): ts.Expression {
  // Extract fallback value from argument (safe regex)
  const arg0 = node.arguments[0];
  const fallbackText = arg0 ? arg0.getText() : "{ fallback: undefined }";
  const match = /fallback\s*:\s*([\s\S]*?)\s*(?:,|$)/m.exec(fallbackText);
  const fallbackExpr = match ? match[1].trim() : "undefined";

  if (isRemovedInProd) {
    const code = `(function(){const F=${fallbackExpr};return(_)=>F;})()`;
    return ts.factory.createIdentifier(code);
  }

  const guard = emitGuardFromType(checker, type);
  const code = [
    "(function(){",
    `  const G=${guard};`,
    `  const F=${fallbackExpr};`,
    "  return (i)=>G(i)?i:F;",
    "})()",
  ].join("\n");

  return ts.factory.createIdentifier(code);
}
