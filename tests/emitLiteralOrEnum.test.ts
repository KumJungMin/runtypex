import { describe, it, expect } from '@jest/globals';
import { emitLiteralOrEnum } from "../src/core/emitLiteralOrEnum";
import { createCtxAndType, norm } from "./utils";

describe("emitLiteralOrEnum", () => {
  it("handles string literal", () => {
    const { ctx, type } = createCtxAndType(`type T = "hello";`, "T");

    const result = emitLiteralOrEnum(ctx, "x", type);

    expect(result).toBe(`x==="hello"`);
  });

  it("handles number literal", () => {
    const { ctx, type } = createCtxAndType(`type N = 42;`, "N");

    const result = emitLiteralOrEnum(ctx, "v", type);

    expect(result).toBe(`v===42`);
  });

  it("handles enum with string values", () => {
    const { ctx, type } = createCtxAndType(
      `
      enum Colors {
        Red = "red",
        Green = "green",
        Blue = "blue"
      }
    `,
      "Colors"
    );

    const result = emitLiteralOrEnum(ctx, "color", type);

    const expected = `(color==="red"||color==="green"||color==="blue")`;
    expect(norm(result!)).toBe(norm(expected));
  });

  it("handles enum with numeric values", () => {
    const { ctx, type } = createCtxAndType(
      `
      enum Status {
        OK = 200,
        NotFound = 404,
      }
    `,
      "Status"
    );

    const result = emitLiteralOrEnum(ctx, "code", type);

    const expected = `(code===200||code===404)`;
    expect(norm(result!)).toBe(norm(expected));
  });

  it("returns null for non-literal/non-enum types", () => {
    const { ctx, type } = createCtxAndType(`type X = { id: number }`, "X");

    const result = emitLiteralOrEnum(ctx, "obj", type);
    
    expect(result).toBeNull();
  });
});