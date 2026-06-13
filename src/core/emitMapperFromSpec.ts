import ts from "typescript";
import { emitGuardFromType } from "./index";
import { emitPathAccess } from "./path";

export type MapperEmitOptions = {
  validateDto?: boolean;
  validateDomain?: boolean;
};

export function emitMapperFromSpec(params: {
  checker: ts.TypeChecker;
  dtoType: ts.Type;
  domainType: ts.Type;
  specNode: ts.Expression;
  sourceFile: ts.SourceFile;
  options?: MapperEmitOptions;
}): string | null {
  const rules = _readRules(params.checker, params.specNode);
  const props = params.checker.getPropertiesOfType(params.domainType);
  const fields: string[] = [];

  for (const prop of props) {
    const from = rules.get(prop.name);
    if (!from) return null;
    fields.push(`${JSON.stringify(prop.name)}:R(${JSON.stringify(prop.name)},${emitPathAccess("input", from)})`);
  }

  const specText = params.specNode.getText(params.sourceFile);
  const dtoGuard =
    params.options?.validateDto === false ? null : emitGuardFromType(params.checker, params.dtoType);
  const domainGuard =
    params.options?.validateDomain === false ? null : emitGuardFromType(params.checker, params.domainType);

  return [
    `(function(){const S=${specText};`,
    dtoGuard ? `const VD=${dtoGuard};` : "",
    domainGuard ? `const VO=${domainGuard};` : "",
    `return(input)=>{`,
    dtoGuard ? `if(!VD(input))throw new TypeError("[runtypex] DTO validation failed.");` : "",
    `const R=(key,raw)=>{const rule=S[key];const value=raw===undefined&&Object.prototype.hasOwnProperty.call(rule,"default")?rule.default:raw;return typeof rule.transform==="function"?rule.transform(value,input):value;};`,
    `const output={${fields.join(",")}};`,
    domainGuard ? `if(!VO(output))throw new TypeError("[runtypex] Domain validation failed.");` : "",
    `return output;};})()`,
  ].join("");
}

function _readRules(checker: ts.TypeChecker, specNode: ts.Expression): Map<string, string> {
  const object = _resolveObject(checker, specNode);
  const rules = new Map<string, string>();
  if (!object) return rules;

  for (const prop of object.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;

    const key = _propertyName(prop.name);
    const from = _readFrom(prop.initializer);
    if (key && from) rules.set(key, from);
  }

  return rules;
}

function _resolveObject(checker: ts.TypeChecker, node: ts.Expression): ts.ObjectLiteralExpression | null {
  const expr = _skip(node);
  if (ts.isObjectLiteralExpression(expr)) return expr;

  if (ts.isCallExpression(expr) && expr.arguments[0]) {
    const arg = _skip(expr.arguments[0]);
    if (ts.isObjectLiteralExpression(arg)) return arg;
  }

  if (ts.isIdentifier(expr)) {
    const symbol = checker.getSymbolAtLocation(expr);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
      return _resolveObject(checker, declaration.initializer);
    }
  }

  return null;
}

function _readFrom(node: ts.Expression): string | null {
  const expr = _skip(node);

  if (ts.isObjectLiteralExpression(expr)) {
    const fromProp = expr.properties.find(
      (prop): prop is ts.PropertyAssignment =>
        ts.isPropertyAssignment(prop) && _propertyName(prop.name) === "from"
    );
    return fromProp ? _stringValue(fromProp.initializer) : null;
  }

  if (ts.isCallExpression(expr) && expr.arguments[0]) {
    return _stringValue(expr.arguments[0]);
  }

  return null;
}

function _skip(node: ts.Expression): ts.Expression {
  let expr = node;
  while (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
    expr = expr.expression;
  }
  return expr;
}

function _propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function _stringValue(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}
