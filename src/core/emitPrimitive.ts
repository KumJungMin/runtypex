import ts from "typescript";
import type { GenContext } from "./index";

/**
 * Handles primitive types like number, string, boolean...
 */
export function emitPrimitive(ctx: GenContext, expr: string, t: ts.Type): string | null {
  if ((t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) return "true";
  if (t.flags & ts.TypeFlags.Null) return `${expr}===null`;
  if (t.flags & ts.TypeFlags.Undefined) return `${expr}===undefined`;
  if (t.flags & ts.TypeFlags.BooleanLike) return `typeof ${expr}==="boolean"`;
  if (t.flags & ts.TypeFlags.NumberLike) return `typeof ${expr}==="number"`;
  if (t.flags & ts.TypeFlags.StringLike) return `typeof ${expr}==="string"`;
  if (t.flags & ts.TypeFlags.BigIntLike) return `typeof ${expr}==="bigint"`;
  if (t.flags & ts.TypeFlags.ESSymbolLike) return `typeof ${expr}==="symbol"`;
  return null;
}
