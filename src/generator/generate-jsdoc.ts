import ts from "typescript";
import { parsePath } from "../core/path.js";
import { findMapPolicyViolations, handleMapPolicyViolations, readMapRules } from "../core/emitMapperFromSpec.js";

const JSDOC_CONTENT_WIDTH = 76;

export type GenerateJSDocOptions = {
  name?: string;
  mappingPolicy?: ts.Expression;
  policyMode?: "warn" | "error";
};

export function generateJSDocFromSpec(params: {
  checker: ts.TypeChecker;
  dtoType: ts.Type;
  domainType: ts.Type;
  specNode: ts.Expression;
  options?: GenerateJSDocOptions;
}): string {
  const checker = params.checker;
  const dtoName = params.dtoType.symbol?.name ?? "Dto";
  const name = params.options?.name ?? params.domainType.symbol?.name ?? "GeneratedDomain";
  const rules = readMapRules(checker, params.specNode);
  const lines = [`export interface ${name} {`];

  handleMapPolicyViolations(
    findMapPolicyViolations(checker, params.specNode, params.options?.mappingPolicy),
    params.options?.policyMode ?? "warn"
  );

  // Each domain property gets source metadata that editors can show on hover.
  for (const prop of checker.getPropertiesOfType(params.domainType)) {
    const rule = rules.get(prop.name);
    if (!rule) throw new Error(`[runtypex/generator] ${name}.${prop.name} is not mapped.`);

    const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
    const domainType = declaration ? checker.getTypeOfSymbolAtLocation(prop, declaration) : checker.getAnyType();
    const dtoPathType = _getTypeAtPath(checker, params.dtoType, rule.from);
    const description = _getDomainDescription(checker, prop) ?? rule.description;
    const optional = (prop.getFlags() & ts.SymbolFlags.Optional) !== 0 ? "?" : "";

    lines.push("  /**");
    if (description) {
      _pushJSDocText(lines, _escapeComment(description));
      lines.push("   *");
    }
    _pushJSDocBulletField(lines, "DTO", _formatCodeSpan(`${dtoName}.${rule.from}`));
    if (rule.dtoDescription) {
      _pushJSDocBulletField(lines, "DTO description", _escapeComment(rule.dtoDescription));
    }
    _pushJSDocBulletField(
      lines,
      "DTO type",
      _formatCodeSpan(dtoPathType ? checker.typeToString(dtoPathType) : "unknown")
    );
    if (rule.db) _pushJSDocBulletField(lines, "Origin", _formatCodeSpan(rule.db));
    _pushJSDocBulletField(lines, "Domain type", _formatCodeSpan(checker.typeToString(domainType)));
    lines.push("   */");
    lines.push(`  ${_propertyName(prop.name)}${optional}: ${checker.typeToString(domainType)};`);
    lines.push("");
  }

  lines.push("}");
  return lines.join("\n");
}

/** Resolves the DTO type reached by a mapping path such as profile.name or items.0.id. */
function _getTypeAtPath(checker: ts.TypeChecker, root: ts.Type, path: string): ts.Type | null {
  let current: ts.Type | null = root;

  for (const segment of parsePath(path)) {
    if (!current) return null;

    if (typeof segment === "number") {
      current =
        (checker as any).getElementTypeOfArrayType?.(current) ??
        (current as ts.TypeReference).typeArguments?.[segment] ??
        current.getNumberIndexType?.() ??
        null;
      continue;
    }

    const prop = checker.getPropertyOfType(current, segment);
    const declaration = prop?.valueDeclaration ?? prop?.declarations?.[0];
    current = prop && declaration ? checker.getTypeOfSymbolAtLocation(prop, declaration) : null;
  }

  return current;
}

function _propertyName(name: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

function _escapeComment(value: string): string {
  return value.replace(/\*\//g, "* /");
}

function _getDomainDescription(checker: ts.TypeChecker, prop: ts.Symbol): string | null {
  const description = ts.displayPartsToString(prop.getDocumentationComment(checker)).trim();
  return description || null;
}

function _pushJSDocBulletField(lines: string[], label: string, value: string): void {
  _pushJSDocText(lines, `- ${label}: ${value}`, "", "  ");
}

function _pushJSDocText(
  lines: string[],
  text: string,
  firstIndent = "",
  continuationIndent = firstIndent
): void {
  for (const line of _wrapJSDocText(text, firstIndent, continuationIndent)) {
    lines.push(`   * ${line}`);
  }
}

function _wrapJSDocText(text: string, firstIndent: string, continuationIndent: string): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [firstIndent.trimEnd()];

  const lines: string[] = [];
  let current = firstIndent;

  for (const word of words) {
    const candidate = current.trim().length ? `${current} ${word}` : `${current}${word}`;
    if (candidate.length <= JSDOC_CONTENT_WIDTH || !current.trim().length) {
      current = candidate;
      continue;
    }

    lines.push(current.trimEnd());
    current = `${continuationIndent}${word}`;
  }

  lines.push(current.trimEnd());
  return lines;
}

function _formatCodeSpan(value: string): string {
  return `\`${_escapeMarkdownCode(_escapeComment(value))}\``;
}

function _escapeMarkdownCode(value: string): string {
  return value.replace(/`/g, "\\`");
}
