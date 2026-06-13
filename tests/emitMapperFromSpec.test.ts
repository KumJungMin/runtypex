import ts from "typescript";
import { describe, expect, it } from "@jest/globals";
import { emitMapperFromSpec } from "../src/core/emitMapperFromSpec";

function fixture() {
  const fileName = "mapper.ts";
  const code = `
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
  `;
  const sourceFile = ts.createSourceFile(fileName, code, ts.ScriptTarget.ESNext, true);
  const host = ts.createCompilerHost({ target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext });
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, ...rest) => (name === fileName ? sourceFile : original(name, ...rest));
  host.writeFile = () => {};

  const program = ts.createProgram({ rootNames: [fileName], options: {}, host });
  const checker = program.getTypeChecker();
  const userDto = checker.getSymbolsInScope(sourceFile, ts.SymbolFlags.Type).find((s) => s.name === "UserDto")!;
  const user = checker.getSymbolsInScope(sourceFile, ts.SymbolFlags.Type).find((s) => s.name === "User")!;
  const userMap = checker.getSymbolsInScope(sourceFile, ts.SymbolFlags.Value).find((s) => s.name === "userMap")!;

  return {
    checker,
    sourceFile,
    dtoType: checker.getDeclaredTypeOfSymbol(userDto),
    domainType: checker.getDeclaredTypeOfSymbol(user),
    specNode: (userMap.valueDeclaration as ts.VariableDeclaration).name as ts.Identifier,
  };
}

describe("emitMapperFromSpec", () => {
  it("emits a validating mapper with safe path access", () => {
    const generated = emitMapperFromSpec(fixture());

    expect(generated).toContain('input["profile"]["name"]');
    expect(generated).toContain("[runtypex] DTO validation failed.");
    expect(generated).toContain("[runtypex] Domain validation failed.");
  });

  it("maps values and applies transform functions", () => {
    const generated = emitMapperFromSpec(fixture());
    const mapper = (0, eval)(`
      (() => {
        const userMap = {
          id: { from: "user_id" },
          displayName: { from: "profile.name" },
          isActive: { from: "status", transform: (value) => value === "ACTIVE" },
        };
        return ${generated};
      })()
    `) as (input: any) => any;

    expect(mapper({ user_id: "u1", profile: { name: "Lux" }, status: "ACTIVE" })).toEqual({
      id: "u1",
      displayName: "Lux",
      isActive: true,
    });
  });
});
