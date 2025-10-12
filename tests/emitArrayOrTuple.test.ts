import { describe, it, expect } from '@jest/globals';
import { emitArrayOrTuple } from "../src/core/emitArrayOrTuple";
import { createCtxAndType, norm } from "./utils";

describe("emitArrayOrTuple", () => {
  it("array type: number[]", () => {
    const { ctx, type } = createCtxAndType("type A = number[];", "A");

    const got = emitArrayOrTuple(ctx, "arr", type) as any;

    const expected = "(Array.isArray(arr)&&arr.every(e=>typeof e===\"number\"))";
    expect(norm(got)).toBe(norm(expected));
  });

  it("tuple type: [string, number]", () => {
    const { ctx, type } = createCtxAndType("type T = [string, number];", "T");

    const got = emitArrayOrTuple(ctx, "t", type) as any;

    const expected = "(Array.isArray(t)&&t.length===2&&typeof t[0]===\"string\"&&typeof t[1]===\"number\")";
    expect(norm(got)).toBe(norm(expected));
  });

  it("array of tuples: [string, number][]", () => {
    const { ctx, type } = createCtxAndType("type C = [string, number][];", "C");
    
    const got = emitArrayOrTuple(ctx, "arr", type) as any;

    const expected = "(Array.isArray(arr)&&arr.every(e=>(Array.isArray(e)&&e.length===2&&typeof e[0]===\"string\"&&typeof e[1]===\"number\")))";
    expect(norm(got)).toBe(norm(expected));
  });

  it("non array/tuple fallback", () => {
    const { ctx, type } = createCtxAndType("type D = { id: number }", "D");

    const got = emitArrayOrTuple(ctx, "x", type) as any;

    expect(got).toBe(null);
  });
});