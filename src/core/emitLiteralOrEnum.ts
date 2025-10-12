import ts from "typescript";
import type { GenContext } from "./index";

/** Handles literal types and enum-like types. */
export function emitLiteralOrEnum(_: GenContext, expr: string, t: ts.Type): string | null {
  if (t.isLiteral()) {
    const value = (t as ts.LiteralType).value;
    const isString = typeof value === "string";
    const newValue = isString ? JSON.stringify(value) : String(value);

    return `${expr}===${newValue}`;
  }

  const isEnum = t.flags & ts.TypeFlags.EnumLike;
  if (isEnum) {
    const enumValues = _extractEnumValues(t);
    if (enumValues.length) {
      return `(${enumValues.map(v => `${expr}===${v}`).join("||")})`;
    }
  }
  return null;
}

// Extracts numeric or string values from an Enum declaration.
function _extractEnumValues(t: ts.Type): string[] {
  const symbol = t.getSymbol();
  if (!symbol) return [];

  const values: string[] = [];
  const declarations = symbol.getDeclarations() ?? [];

  for (const declaration of declarations) {
    const isEnum = ts.isEnumDeclaration(declaration);

    if (!isEnum) continue;
    for (const member of declaration.members) {
      const init = member.initializer;
      if (!init) continue;

      if (ts.isStringLiteral(init) || ts.isNumericLiteral(init)) {
        const value = ts.isStringLiteral(init) ? JSON.stringify(init.text) : init.text;
        values.push(value);
      }
    }
  }
  return values;
}
