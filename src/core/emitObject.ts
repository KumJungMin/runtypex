import ts from "typescript";
import type { GenContext } from "./index";

/**
 * Handles interfaces, classes, and object-like structures.
 */
export function emitObject(ctx: GenContext, expr: string, t: ts.Type): string | null {
  const isObject = (t.getFlags() & ts.TypeFlags.Object) !== 0;

  if (!isObject) return null;

  const props = ctx.checker.getPropertiesOfType(t);
  const parts: string[] = [`typeof ${expr}==="object"`, `${expr}!==null`];

  for (const prop of props) {
    const declaration = prop.valueDeclaration ?? prop.declarations?.[0];
    if (!declaration) continue;

    const propType = ctx.checker.getTypeOfSymbolAtLocation(prop, declaration);
    const isOptional = (prop.getFlags() & ts.SymbolFlags.Optional) !== 0;
    const condition = ctx.emit(`${expr}.${prop.name}`, propType);
    const checkExpr = isOptional ? `(${expr}.${prop.name}===undefined||${condition})` : condition;
    
    parts.push(checkExpr);
  }

  return `(${parts.join("&&")})`;
}
