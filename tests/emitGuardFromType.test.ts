import { describe, it, expect } from '@jest/globals';
import { emitGuardFromType } from "../src/core";
import { createCtxAndType, norm } from "./utils";


describe("emitGuardFromType (integration)", () => {
  it("emits for primitive types", () => {
    const { checker, type } = createCtxAndType(`type T = number;`, "T");
    const result = emitGuardFromType(checker, type);

    expect(norm(result)).toBe(norm(`(input)=>typeof input==="number"`));
  });

  it("emits for interface", () => {
    const { checker, type } = createCtxAndType(
      `
      interface User {
        id: number;
        name: string;
      }
      `,
      "User"
    );

    const result = emitGuardFromType(checker, type);
    
    const expected = `(input)=>(typeof input==="object"&&input!==null&&typeof input.id==="number"&&typeof input.name==="string")`;
    expect(norm(result)).toBe(norm(expected));
  });

  it("emits for nested object", () => {
    const { checker, type } = createCtxAndType(
      `
      interface Address { city: string; zip: number; }
      interface User { name: string; address: Address; }
      `,
      "User"
    );

    const result = emitGuardFromType(checker, type);

    const expected = `(input)=>(typeof input==="object"&&input!==null&&typeof input.name==="string"&&(typeof input.address==="object"&&input.address!==null&&typeof input.address.city==="string"&&typeof input.address.zip==="number"))`;
    expect(norm(result)).toBe(norm(expected));
  });

  it("emits for union type", () => {
    const { checker, type } = createCtxAndType(`type T = string | number;`, "T");

    const result = emitGuardFromType(checker, type);

    const expected = `(input)=>(typeof input==="string"||typeof input==="number")`;
    expect(norm(result)).toBe(norm(expected));
  });

  it("emits for intersection type", () => {
    const { checker, type } = createCtxAndType(
      `
      type A = { id: number };
      type B = { name: string };
      type AB = A & B;
      `,
      "AB"
    );

    const result = emitGuardFromType(checker, type);

    const expected =
      `(input)=>((typeof input===\"object\"&&input!==null&&typeof input.id===\"number\")&&(typeof input===\"object\"&&input!==null&&typeof input.name===\"string\"))`;
    expect(norm(result)).toBe(norm(expected));
  });

  it("emits for array type", () => {
    const { checker, type } = createCtxAndType(`type T = number[];`, "T");

    const result = emitGuardFromType(checker, type);

    const expected = `(input)=>(Array.isArray(input)&&input.every(e=>typeof e==="number"))`;
    expect(norm(result)).toBe(norm(expected));
  });

  it("emits for tuple type", () => {
    const { checker, type } = createCtxAndType(`type T = [string, number];`, "T");

    const result = emitGuardFromType(checker, type);

    const expected =
      `(input)=>(Array.isArray(input)&&input.length===2&&typeof input[0]==="string"&&typeof input[1]==="number")`;
    expect(norm(result)).toBe(norm(expected));
  });

  it("emits for nested array of objects", () => {
    const { checker, type } = createCtxAndType(
      `
      interface Item { name: string; price: number; }
      type T = Item[];
      `,
      "T"
    );

    const result = emitGuardFromType(checker, type);

    const expected =
      `(input)=>(Array.isArray(input)&&input.every(e=>(typeof e==="object"&&e!==null&&typeof e.name==="string"&&typeof e.price==="number")))`;
    expect(norm(result)).toBe(norm(expected));
  });

  it("emits for enum type", () => {
    const { checker, type } = createCtxAndType(
      `
      enum Color { Red = "RED", Blue = "BLUE" }
      type T = Color;
      `,
      "T"
    );

    const result = emitGuardFromType(checker, type);

    const expected = `(input)=>(input==="RED"||input==="BLUE")`;
    expect(norm(result)).toBe(norm(expected));
  });

  it("handles optional properties", () => {
    const { checker, type } = createCtxAndType(
      `
      interface User {
        id: number;
        name?: string;
      }
      `,
      "User"
    );

    const result = emitGuardFromType(checker, type);

    const expected =
      `(input)=>(typeof input==="object"&&input!==null&&typeof input.id==="number"&&(input.name===undefined||typeof input.name==="string"))`;
    expect(norm(result)).toBe(norm(expected));
  });
});