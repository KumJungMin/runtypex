import ts from "typescript";
import { emitGuardFromType } from "../core/index.js";
import { emitMapperFromSpec } from "../core/emitMapperFromSpec.js";

type TransformerOptions = {
  program: ts.Program;
  removeInProd?: boolean;
  validateDto?: boolean;
  validateDomain?: boolean;
};

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
export default function tsTransformer(options: TransformerOptions): ts.TransformerFactory<ts.SourceFile> {
  const checker = options.program.getTypeChecker();
  const removeInProd = !!options.removeInProd;
  const prod = process.env.NODE_ENV === "production";

  return (context: ts.TransformationContext) => {
    const visit: ts.Visitor = (node: ts.Node): ts.Node => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;

        if ((name === "makeValidate" || name === "makeAssert") && node.typeArguments?.length) {
          const type = checker.getTypeFromTypeNode(node.typeArguments[0]);
          const isRemovedInProd = removeInProd && prod;

          switch (name) {
            case "makeValidate":
              return _emitMakeValidate(checker, type, isRemovedInProd);
            case "makeAssert":
              return _emitMakeAssert(checker, type, isRemovedInProd);
          }
        }

        // makeMapper<TDto, TDomain>(spec) becomes an inline validating mapper.
        if (name === "makeMapper" && node.typeArguments?.length === 2 && node.arguments[0]) {
          const mapperCallOptions = _readMapperCallOptions(node.arguments[1]);
          const mapper = emitMapperFromSpec({
            checker,
            dtoType: checker.getTypeFromTypeNode(node.typeArguments[0]),
            domainType: checker.getTypeFromTypeNode(node.typeArguments[1]),
            specNode: node.arguments[0],
            sourceFile: node.getSourceFile(),
            options: {
              validateDto: !(removeInProd && prod) && options.validateDto !== false,
              validateDomain: !(removeInProd && prod) && options.validateDomain !== false,
              mappingPolicy: mapperCallOptions.policy,
              policyMode: mapperCallOptions.policyMode,
            },
          });

          if (mapper) return ts.factory.createIdentifier(mapper) as any;
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sf: ts.SourceFile) => ts.visitNode(sf, visit) as ts.SourceFile;
  };
}

function _readMapperCallOptions(node: ts.Expression | undefined): {
  policy?: ts.Expression;
  policyMode?: "warn" | "error";
} {
  if (!node) return {};

  const expr = ts.isAsExpression(node) || ts.isParenthesizedExpression(node) ? node.expression : node;
  if (!ts.isObjectLiteralExpression(expr)) return {};

  return {
    policy: _readExpressionProperty(expr, "policy"),
    policyMode: _readPolicyMode(expr),
  };
}

function _readExpressionProperty(object: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const item of object.properties) {
    if (ts.isPropertyAssignment(item) && ts.isIdentifier(item.name) && item.name.text === name) {
      return item.initializer;
    }
    if (ts.isShorthandPropertyAssignment(item) && item.name.text === name) {
      return item.name;
    }
  }
  return undefined;
}

function _readPolicyMode(object: ts.ObjectLiteralExpression): "warn" | "error" | undefined {
  const mode = _readExpressionProperty(object, "policyMode");
  return mode && ts.isStringLiteral(mode) && (mode.text === "warn" || mode.text === "error") ? mode.text : undefined;
}

function _emitMakeValidate(checker: ts.TypeChecker, type: ts.Type, isRemovedInProd: boolean): ts.Identifier {
  const guard = isRemovedInProd ? "((_)=>true)" : emitGuardFromType(checker, type);

  return ts.factory.createIdentifier(guard) as any;
}

function _emitMakeAssert(checker: ts.TypeChecker, type: ts.Type, isRemovedInProd: boolean): ts.Identifier {
  if (isRemovedInProd) return ts.factory.createIdentifier("((_)=>{})") as any;

  const guard = emitGuardFromType(checker, type);
  const txt = `(function(){const G=${guard};return(i)=>{if(!G(i))throw new TypeError("[runtypex] Validation failed.");};})()`;

  return ts.factory.createIdentifier(txt) as any;
}
