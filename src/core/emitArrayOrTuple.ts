import ts from "typescript";
import type { GenContext } from "./index";

/**
 * Handles array (T[]) and tuple ([A, B]) types.
 */
export function emitArrayOrTuple(ctx: GenContext, expr: string, t: ts.Type): string | null {
  if (ctx.checker.isTupleType(t)) {
    return _emitTuple(t as ts.TypeReference, expr, ctx);
  }
  if (ctx.checker.isArrayType(t)) {
    return _emitArray(ctx, expr, t);
  }
  return null;
}

/**
 * Generate validation for Array<T>
 */
function _emitArray(ctx: GenContext, expr: string, t: ts.Type): string {
  const arrayCheck = `Array.isArray(${expr})`;

  // Try extracting element type
  const element =
    (ctx.checker as any).getElementTypeOfArrayType?.(t) ||
    (t as ts.TypeReference).typeArguments?.[0] ||
    t.getNumberIndexType?.();

  if (!element) return arrayCheck;
  const eachCheck = `${expr}.every(e=>${ctx.emit("e", element)})`;
  return `(${arrayCheck}&&${eachCheck})`;
}

/**
 * Generate validation for Tuple [A, B, ...]
 */
function _emitTuple(ref: ts.TypeReference, expr: string, ctx: GenContext): string {
  const elements = ref.typeArguments ?? (ctx.checker as any).getTypeArguments?.(ref) ?? [];

  const arrayCheck = `Array.isArray(${expr})`;
  const lenCheck = `${expr}.length===${elements.length}`;
  const elementChecks = elements.map((el: ts.Type, i: number) => ctx.emit(`${expr}[${i}]`, el));

  const parts = [arrayCheck, lenCheck, ...elementChecks];
  return `(${parts.join("&&")})`;
}
