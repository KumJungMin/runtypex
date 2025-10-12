import { describe, it, expect } from '@jest/globals';
import { emitObject } from "../src/core/emitObject";
import { createCtxAndType, norm } from "./utils";


describe("emitObject", () => {
  it("emits object guard for simple interface", () => {
    const { ctx, type } = createCtxAndType(
      `
      interface User {
        id: number;
        name: string;
      }
    `,
      "User"
    );

    const result = emitObject(ctx, "u", type);
    const expected =
      '(typeof u==="object"&&u!==null&&typeof u.id==="number"&&typeof u.name==="string")';

    expect(norm(result!)).toBe(norm(expected));
  });

  it("handles optional properties", () => {
    const { ctx, type } = createCtxAndType(
      `
      interface User {
        id: number;
        name?: string;
      }
    `,
      "User"
    );

    const result = emitObject(ctx, "user", type);
    const expected =
      '(typeof user==="object"&&user!==null&&typeof user.id==="number"&&(user.name===undefined||typeof user.name==="string"))';

    expect(norm(result!)).toBe(norm(expected));
  });

  it("returns null for non-object types", () => {
    const { ctx, type } = createCtxAndType(`type T = number;`, "T");
    const result = emitObject(ctx, "v", type);
    expect(result).toBeNull();
  });
});