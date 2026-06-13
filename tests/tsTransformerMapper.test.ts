import ts from "typescript";
import { describe, expect, it } from "@jest/globals";
import tsTransformer from "../src/transformer/ts-transformer";

function transformSource(code: string, removeInProd = false) {
  const fileName = "input.ts";
  const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.ESNext, true);
  const host = ts.createCompilerHost({ target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext });
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, ...rest) => (name === fileName ? sourceFile : original(name, ...rest));
  host.writeFile = () => {};

  const program = ts.createProgram({ rootNames: [fileName], options: {}, host });
  const result = ts.transform(sourceFile, [tsTransformer({ program, removeInProd })]);
  return ts.createPrinter().printFile(result.transformed[0] as ts.SourceFile);
}

describe("tsTransformer makeMapper", () => {
  it("replaces makeMapper calls with generated mapper functions", () => {
    const output = transformSource(`
      interface UserDto {
        user_id: string;
        profile: { name: string };
        status: "ACTIVE" | "INACTIVE";
      }
      interface User {
        id: string;
        displayName: string;
        isActive: boolean;
      }
      const userMap = {
        id: { from: "user_id" },
        displayName: { from: "profile.name" },
        isActive: { from: "status", transform: (value: unknown) => value === "ACTIVE" },
      };
      const toUser = makeMapper<UserDto, User>(userMap);
    `);

    expect(output).toContain('input["user_id"]');
    expect(output).toContain('input["profile"]["name"]');
    expect(output).toContain("[runtypex] DTO validation failed.");
    expect(output).not.toContain("makeMapper<UserDto, User>");
  });

  it("removes mapper validation in production removal mode", () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const output = transformSource(`
      interface UserDto { id: string }
      interface User { id: string }
      const userMap = { id: { from: "id" } };
      const toUser = makeMapper<UserDto, User>(userMap);
    `, true);

    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;

    expect(output).toContain('input["id"]');
    expect(output).not.toContain("DTO validation failed");
    expect(output).not.toContain("Domain validation failed");
  });
});
