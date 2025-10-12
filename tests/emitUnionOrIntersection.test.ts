import { describe, it, expect } from '@jest/globals';
import { emitUnionOrIntersection } from "../src/core/emitUnionOrIntersection";
import { createCtxAndType, norm } from "./utils";

describe("emitUnionOrIntersection", () => {
  it("emits union type as OR (||) condition", () => {
    const { ctx, type } = createCtxAndType(`type T = number | string;`, "T");
    const result = emitUnionOrIntersection(ctx, "x", type);

    // Union: typeof x==="number" || typeof x==="string"
    const expected = `(typeof x==="string"||typeof x==="number")`;
    expect(norm(result!)).toBe(norm(expected));
  });

  it("returns null for non-union/intersection types", () => {
    const { ctx, type } = createCtxAndType(`type T = number;`, "T");
    const result = emitUnionOrIntersection(ctx, "v", type);
    expect(result).toBeNull();
  });
});