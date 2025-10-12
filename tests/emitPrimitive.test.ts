import { describe, it, expect } from '@jest/globals';
import { emitPrimitive } from "../src/core/emitPrimitive";
import { createCtxAndType, norm } from "./utils";

describe("emitPrimitive", () => {
  it("handles number type", () => {
    const { ctx, type } = createCtxAndType(`type T = number;`, "T");
    const result = emitPrimitive(ctx, "x", type);
    expect(result).toBe(`typeof x==="number"`);
  });

  it("handles string type", () => {
    const { ctx, type } = createCtxAndType(`type T = string;`, "T");
    const result = emitPrimitive(ctx, "x", type);
    expect(result).toBe(`typeof x==="string"`);
  });

  it("handles boolean type", () => {
    const { ctx, type } = createCtxAndType(`type T = boolean;`, "T");
    const result = emitPrimitive(ctx, "x", type);
    expect(result).toBe(`typeof x==="boolean"`);
  });

  it("handles bigint type", () => {
    const { ctx, type } = createCtxAndType(`type T = bigint;`, "T");
    const result = emitPrimitive(ctx, "x", type);
    expect(result).toBe(`typeof x==="bigint"`);
  });

  it("handles symbol type", () => {
    const { ctx, type } = createCtxAndType(`type T = symbol;`, "T");
    const result = emitPrimitive(ctx, "x", type);
    expect(result).toBe(`typeof x==="symbol"`);
  });

  it("handles null type", () => {
    const { ctx, type } = createCtxAndType(`type T = null;`, "T");
    const result = emitPrimitive(ctx, "x", type);
    expect(result).toBe(`x===null`);
  });

  it("handles undefined type", () => {
    const { ctx, type } = createCtxAndType(`type T = undefined;`, "T");
    const result = emitPrimitive(ctx, "x", type);
    expect(result).toBe(`x===undefined`);
  });

  it("handles any or unknown types", () => {
    const { ctx, type } = createCtxAndType(`type T = any;`, "T");
    const result = emitPrimitive(ctx, "x", type);
    expect(result).toBe("true");

    const { ctx: ctx2, type: type2 } = createCtxAndType(`type T = unknown;`, "T");
    const result2 = emitPrimitive(ctx2, "y", type2);
    expect(result2).toBe("true");
  });

  it("returns null for object type", () => {
    const { ctx, type } = createCtxAndType(`type T = { id: number };`, "T");
    const result = emitPrimitive(ctx, "x", type);
    expect(result).toBeNull();
  });
});