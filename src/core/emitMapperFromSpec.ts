import ts from "typescript";
import { emitGuardFromType } from "./index";
import { emitPathAccess } from "./path";

export type MapperEmitOptions = {
  validateDto?: boolean;
  validateDomain?: boolean;
};

export type MapRuleInfo = {
  key: string;
  from: string;
  db?: string;
  description?: string;
};

export function emitMapperFromSpec(params: {
  checker: ts.TypeChecker;
  dtoType: ts.Type;
  domainType: ts.Type;
  specNode: ts.Expression;
  sourceFile: ts.SourceFile;
  options?: MapperEmitOptions;
}): string | null {
  const rules = readMapRules(params.checker, params.specNode);
  const props = params.checker.getPropertiesOfType(params.domainType);
  const fields: string[] = [];

  for (const prop of props) {
    const rule = rules.get(prop.name);
    if (!rule) return null;
    fields.push(`${JSON.stringify(prop.name)}:R(${JSON.stringify(prop.name)},${emitPathAccess("input", rule.from)})`);
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

export function readMapRules(checker: ts.TypeChecker, specNode: ts.Expression): Map<string, MapRuleInfo> {
  const object = _resolveObject(checker, specNode);
  const rules = new Map<string, MapRuleInfo>();
  if (!object) return rules;

  for (const prop of object.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;

    const key = _propertyName(prop.name);
    const rule = _readRule(prop.initializer);
    if (key && rule) rules.set(key, { key, ...rule });
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

function _readRule(node: ts.Expression): Omit<MapRuleInfo, "key"> | null {
  const expr = _skip(node);

  if (ts.isObjectLiteralExpression(expr)) {
    return _readRuleObject(expr);
  }

  if (ts.isCallExpression(expr) && expr.arguments[0]) {
    const from = _stringValue(expr.arguments[0]);
    const metadata = expr.arguments.length > 2 ? expr.arguments[2] : expr.arguments[1];
    if (!from) return null;
    return { from, ..._readMetadata(metadata) };
  }

  return null;
}

function _readRuleObject(object: ts.ObjectLiteralExpression): Omit<MapRuleInfo, "key"> | null {
  const from = _readStringProperty(object, "from");
  if (!from) return null;

  return {
    from,
    db: _readStringProperty(object, "db") ?? undefined,
    description: _readStringProperty(object, "description") ?? undefined,
  };
}

function _readMetadata(node: ts.Expression | undefined): Partial<Omit<MapRuleInfo, "key" | "from">> {
  const expr = node ? _skip(node) : null;
  if (!expr || !ts.isObjectLiteralExpression(expr)) return {};

  return {
    db: _readStringProperty(expr, "db") ?? undefined,
    description: _readStringProperty(expr, "description") ?? undefined,
  };
}

function _readStringProperty(object: ts.ObjectLiteralExpression, name: string): string | null {
  const prop = object.properties.find(
    (item): item is ts.PropertyAssignment =>
      ts.isPropertyAssignment(item) && _propertyName(item.name) === name
  );
  return prop ? _stringValue(prop.initializer) : null;
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
