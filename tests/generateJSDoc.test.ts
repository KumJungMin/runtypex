import ts from "typescript";
import { describe, expect, it } from "@jest/globals";
import { generateJSDocFromSpec } from "../src/generator/generate-jsdoc";

function fixture() {
  const fileName = "doc.ts";
  const code = `
    interface UserDto {
      user_id: string;
      profile: { name: string };
    }
    interface User {
      id: string;
      displayName: string;
    }
    const userMap = {
      id: {
        from: "user_id",
        db: "users.user_id",
        description: "User id",
        dtoDescription: "this is user ID",
      },
      displayName: { from: "profile.name", description: "Display name" },
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
    dtoType: checker.getDeclaredTypeOfSymbol(userDto),
    domainType: checker.getDeclaredTypeOfSymbol(user),
    specNode: (userMap.valueDeclaration as ts.VariableDeclaration).name as ts.Identifier,
  };
}

describe("generateJSDocFromSpec", () => {
  it("generates an interface with mapper metadata in JSDoc", () => {
    const output = generateJSDocFromSpec(fixture());

    expect(output).toContain("export interface User");
    expect(output).toContain("* DTO: UserDto.user_id 유저의 id입니다.");
    expect(output).toContain("* DTO type: string");
    expect(output).toContain("* DB: users.user_id");
    expect(output).toContain("displayName: string;");
  });
});
