import ts from "typescript";
import { emitPrimitive } from "./emitPrimitive";
import { emitLiteralOrEnum } from "./emitLiteralOrEnum";
import { emitUnionOrIntersection } from "./emitUnionOrIntersection";
import { emitArrayOrTuple } from "./emitArrayOrTuple";
import { emitObject } from "./emitObject";

/**
 * ✅ emitGuardFromType
 * Converts a TypeScript type to a JavaScript runtime validation function string.
 */
export function emitGuardFromType(checker: ts.TypeChecker, type: ts.Type): string {
  const ctx = new GenContext(checker);
  const condition = ctx.emit("input", type);
  return `(input)=>${condition}`;
}

/**
 * ✅ GenContext
 * Internal helper for converting TypeScript types to JS validation expressions.
 */
export class GenContext {
  private seen = new Map<ts.Type, string>();

  constructor(public checker: ts.TypeChecker) {}

  /** Top-level router — delegates each type to the correct handler. */
  emit(expr: string, t: ts.Type): string {
    if (this.seen.has(t)) return this.seen.get(t)!;

    return (
      emitPrimitive(this, expr, t) ??
      emitLiteralOrEnum(this, expr, t) ??
      emitUnionOrIntersection(this, expr, t) ??
      emitArrayOrTuple(this, expr, t) ??
      emitObject(this, expr, t) ??
      "true"
    );
  }
}
