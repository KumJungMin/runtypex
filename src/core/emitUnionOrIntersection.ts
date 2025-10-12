import ts from "typescript";
import type { GenContext } from "./index";

/**
 * Handles union (A | B) and intersection (A & B) types.
 */
export function emitUnionOrIntersection(ctx: GenContext, expr: string, t: ts.Type): string | null {
  if (t.isUnion()) {
    return `(${t.types.map(tt => ctx.emit(expr, tt)).join("||")})`;
  }
  if (t.isIntersection()) {
    return `(${t.types.map(tt => ctx.emit(expr, tt)).join("&&")})`;
  }
  return null;
}
