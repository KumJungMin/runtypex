import ts from "typescript";
import { emitGuardFromType } from "./index.js";
import { emitPathAccess } from "./path.js";

export type MapperEmitOptions = {
  validateDto?: boolean;
  validateDomain?: boolean;
  mappingPolicy?: ts.Expression;
  policyMode?: "warn" | "error";
};

export type MapRuleInfo = {
  key: string;
  from: string;
  db?: string;
  /** @deprecated Prefer domain property JSDoc for domain field descriptions. */
  description?: string;
  dtoDescription?: string;
};

export function emitMapperFromSpec(params: {
  checker: ts.TypeChecker;
  dtoType: ts.Type;
  domainType: ts.Type;
  specNode: ts.Expression;
  sourceFile: ts.SourceFile;
  options?: MapperEmitOptions;
}): string | null {
  // Resolve the concrete object literal so generated code does not retain DSL calls.
  const specObject = resolveMapSpecObject(params.checker, params.specNode);
  if (!specObject) return null;

  handleMapPolicyViolations(
    findMapPolicyViolations(params.checker, specObject, params.options?.mappingPolicy),
    params.options?.policyMode ?? "warn"
  );

  const rules = readMapRules(params.checker, specObject);
  const props = params.checker.getPropertiesOfType(params.domainType);
  const fields: string[] = [];

  for (const prop of props) {
    const rule = rules.get(prop.name);
    if (!rule) return null;
    fields.push(`${JSON.stringify(prop.name)}:R(${JSON.stringify(prop.name)},${emitPathAccess("input", rule.from)})`);
  }

  const specText = _emitRuntimeSpecText(specObject, params.sourceFile);
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
  const object = resolveMapSpecObject(checker, specNode);
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

export type MapPolicyViolation = {
  from: string;
  expectedKey: string;
  actualKey: string;
};

export function findMapPolicyViolations(
  checker: ts.TypeChecker,
  specNode: ts.Expression,
  policyNode: ts.Expression | undefined
): MapPolicyViolation[] {
  if (!policyNode) return [];

  const rules = readMapRules(checker, specNode);
  const policyRules = readMapRules(checker, policyNode);
  const canonicalByPath = new Map<string, string>();
  const violations: MapPolicyViolation[] = [];

  for (const rule of policyRules.values()) {
    const existing = canonicalByPath.get(rule.from);
    if (existing && existing !== rule.key) {
      violations.push({ from: rule.from, expectedKey: existing, actualKey: rule.key });
      continue;
    }
    canonicalByPath.set(rule.from, rule.key);
  }

  violations.push(...Array.from(rules.values()).flatMap((rule) => {
    const expected = canonicalByPath.get(rule.from);
    return expected && expected !== rule.key
      ? [{ from: rule.from, expectedKey: expected, actualKey: rule.key }]
      : [];
  }));

  return violations;
}

export function handleMapPolicyViolations(violations: MapPolicyViolation[], mode: "warn" | "error"): void {
  if (!violations.length) return;

  const details = violations
    .map((item) =>
      `DTO path "${item.from}" is canonically mapped as "${item.expectedKey}", but this map uses "${item.actualKey}".`
    )
    .join("\n");
  const message = `[runtypex/mapper] Mapping policy violation:\n${details}`;

  if (mode === "error") throw new Error(message);
  console.warn(message);
}

/** Finds the mapping object behind inline, defineMap-wrapped, or identifier specs. */
export function resolveMapSpecObject(checker: ts.TypeChecker, node: ts.Expression): ts.ObjectLiteralExpression | null {
  const expr = _skip(node);
  if (ts.isObjectLiteralExpression(expr)) return expr;

  if (ts.isCallExpression(expr) && expr.arguments[0]) {
    const arg = _skip(expr.arguments[0]);
    if (ts.isObjectLiteralExpression(arg)) return arg;
  }

  if (ts.isCallExpression(expr) && ts.isCallExpression(expr.expression)) {
    return resolveMapSpecObject(checker, expr.expression);
  }

  if (ts.isIdentifier(expr)) {
    const symbol = checker.getShorthandAssignmentValueSymbol?.(expr) ?? checker.getSymbolAtLocation(expr);
    const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
    if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
      return resolveMapSpecObject(checker, declaration.initializer);
    }

    const variable = _findVariableDeclaration(expr.getSourceFile(), expr.text, expr.getStart(expr.getSourceFile()));
    if (variable?.initializer) return resolveMapSpecObject(checker, variable.initializer);
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
    dtoDescription: _readStringProperty(object, "dtoDescription") ?? undefined,
  };
}

function _readMetadata(node: ts.Expression | undefined): Partial<Omit<MapRuleInfo, "key" | "from">> {
  const expr = node ? _skip(node) : null;
  if (!expr || !ts.isObjectLiteralExpression(expr)) return {};

  return {
    db: _readStringProperty(expr, "db") ?? undefined,
    description: _readStringProperty(expr, "description") ?? undefined,
    dtoDescription: _readStringProperty(expr, "dtoDescription") ?? undefined,
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

function _findVariableDeclaration(sourceFile: ts.SourceFile, name: string, before: number): ts.VariableDeclaration | null {
  let found: ts.VariableDeclaration | null = null;

  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.getStart(sourceFile) < before
    ) {
      found = node;
    }
    node.forEachChild(visit);
  };

  visit(sourceFile);
  return found;
}

function _emitRuntimeSpecText(specObject: ts.ObjectLiteralExpression, sourceFile: ts.SourceFile): string {
  // Remove TypeScript-only syntax from inline transform callbacks before embedding.
  const marker = "__runtypexSpec";
  const output = ts.transpileModule(`const ${marker} = ${specObject.getText(sourceFile)};`, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
    },
  }).outputText.trim();
  const prefix = `const ${marker} = `;

  return output.startsWith(prefix) ? output.slice(prefix.length).replace(/;$/, "") : specObject.getText(sourceFile);
}
