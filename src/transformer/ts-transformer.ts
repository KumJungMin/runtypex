import ts from "typescript";
import { emitGuardFromType } from "../core/index";
import { resolveTypeByName } from "./helper";

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
          const type = resolveTypeByName(program, node.getSourceFile(), checker, typeName);

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


function _emitMakeValidate(checker: ts.TypeChecker, type: ts.Type, isRemovedInProd: boolean): ts.Identifier {
  const guard = isRemovedInProd ? "((_)=>true)" : emitGuardFromType(checker, type); 

  return ts.factory.createIdentifier(guard) as any;
}

function _emitMakeAssert(checker: ts.TypeChecker, type: ts.Type, isRemovedInProd: boolean): ts.Identifier {
  const guard = isRemovedInProd ? "((_)=>{})" : emitGuardFromType(checker, type);
  const txt = `(function(){const G=${guard};return(i)=>{if(!G(i))throw new TypeError("[runtypex] Validation failed.");};})()`;
  
  return ts.factory.createIdentifier(txt) as any;
}