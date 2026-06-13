import path from "node:path";
import ts from "typescript";
import { generateJSDocFromSpec } from "./generate-jsdoc.js";

export type GeneratedDocsFileNameContext = {
  sourceFileName: string;
  sourceFileBaseName: string;
  sourceFileDir: string;
  rootDir: string;
};

export type GeneratedDocsFileName =
  | string
  | ((context: GeneratedDocsFileNameContext) => string);

export type RuntypexDocsOptions =
  | boolean
  | {
      include?: string | string[];
      exclude?: string | string[];
      sourceSuffix?: string;
      generatedFileName?: GeneratedDocsFileName;
      outDir?: "near-source";
      policyMode?: "warn" | "error";
    };

export type GeneratedDocsFile = {
  fileName: string;
  content: string;
};

type NormalizedDocsOptions = {
  include: string[];
  exclude: string[];
  sourceSuffix: string;
  generatedFileName: GeneratedDocsFileName;
  policyMode: "warn" | "error";
};

type MapperDoc = {
  generatedName: string;
  dtoType: ts.Type;
  domainType: ts.Type;
  specNode: ts.Expression;
};

export function generateDocsFromProgram(params: {
  program: ts.Program;
  rootDir: string;
  docs: RuntypexDocsOptions;
}): GeneratedDocsFile[] {
  const options = _normalizeDocsOptions(params.docs);
  if (!options) return [];

  const checker = params.program.getTypeChecker();
  const groups = new Map<string, MapperDoc[]>();

  const sourceFiles = params.program
    .getSourceFiles()
    .filter((sourceFile) => !sourceFile.isDeclarationFile && _isIncluded(sourceFile.fileName, params.rootDir, options))
    .sort((a, b) => _toPosix(a.fileName).localeCompare(_toPosix(b.fileName)));

  for (const sourceFile of sourceFiles) {
    const mapperDocs = _findMapperDocs(checker, sourceFile, options);
    if (!mapperDocs.length) continue;

    const generatedFileName = _resolveGeneratedFileName(sourceFile, params.rootDir, options);
    const fileName = path.join(path.dirname(sourceFile.fileName), generatedFileName);

    for (const doc of mapperDocs) {
      const docs = groups.get(fileName) ?? [];
      docs.push(doc);
      groups.set(fileName, docs);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => _toPosix(a).localeCompare(_toPosix(b)))
    .map(([fileName, docs]) => ({
      fileName,
      content: _generateFileContent(checker, fileName, docs, options),
    }));
}

function _normalizeDocsOptions(options: RuntypexDocsOptions): NormalizedDocsOptions | null {
  if (!options) return null;
  const object = typeof options === "object" ? options : {};
  if (object.outDir && object.outDir !== "near-source") {
    throw new Error('[runtypex/docs] docs.outDir currently supports only "near-source".');
  }

  const generatedFileName = object.generatedFileName ?? "runtypex.generated.ts";
  const generatedFileExcludes =
    typeof generatedFileName === "string" ? [`**/${generatedFileName}`] : ["**/*.generated.ts"];

  return {
    include: _array(object.include ?? ["**/*.mapper.ts", "**/*.mapper.tsx"]),
    exclude: [..._array(object.exclude), ...generatedFileExcludes],
    sourceSuffix: object.sourceSuffix ?? "Source",
    generatedFileName,
    policyMode: object.policyMode ?? "warn",
  };
}

function _resolveGeneratedFileName(
  sourceFile: ts.SourceFile,
  rootDir: string,
  options: NormalizedDocsOptions
): string {
  if (typeof options.generatedFileName === "function") {
    return options.generatedFileName({
      sourceFileName: sourceFile.fileName,
      sourceFileBaseName: path.basename(sourceFile.fileName),
      sourceFileDir: path.dirname(sourceFile.fileName),
      rootDir,
    });
  }

  return options.generatedFileName;
}

function _isIncluded(fileName: string, rootDir: string, options: NormalizedDocsOptions): boolean {
  return (
    _matchesAny(fileName, rootDir, options.include) &&
    !_matchesAny(fileName, rootDir, options.exclude)
  );
}

function _findMapperDocs(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  options: NormalizedDocsOptions
): MapperDoc[] {
  const docs: MapperDoc[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const map = _readDefineMapCall(node.initializer);
      if (map) {
        const domainType = checker.getTypeFromTypeNode(map.domainTypeNode);
        const domainName = _typeName(checker, domainType, map.domainTypeNode, sourceFile);
        const generatedName = _generatedName(domainName, options.sourceSuffix);

        if (generatedName) {
          docs.push({
            generatedName,
            dtoType: checker.getTypeFromTypeNode(map.dtoTypeNode),
            domainType,
            specNode: map.specNode,
          });
        } else {
          _handleConventionIssue(
            `[runtypex/docs] Skipping ${node.name.text}: ${_generatedNameIssue(domainName, options.sourceSuffix)}.`,
            options.policyMode
          );
        }
      }
    }

    node.forEachChild(visit);
  };

  visit(sourceFile);
  return docs;
}

function _readDefineMapCall(node: ts.Expression): {
  dtoTypeNode: ts.TypeNode;
  domainTypeNode: ts.TypeNode;
  specNode: ts.Expression;
} | null {
  const specCall = _skip(node);
  if (!ts.isCallExpression(specCall) || !specCall.arguments[0]) return null;

  const factoryCall = _skip(specCall.expression);
  if (!ts.isCallExpression(factoryCall) || factoryCall.typeArguments?.length !== 2) return null;
  if (!_isDefineMapExpression(_skip(factoryCall.expression))) return null;

  return {
    dtoTypeNode: factoryCall.typeArguments[0],
    domainTypeNode: factoryCall.typeArguments[1],
    specNode: specCall,
  };
}

function _isDefineMapExpression(node: ts.Expression): boolean {
  return (
    (ts.isIdentifier(node) && node.text === "defineMap") ||
    (ts.isPropertyAccessExpression(node) && node.name.text === "defineMap")
  );
}

function _generateFileContent(
  checker: ts.TypeChecker,
  fileName: string,
  docs: MapperDoc[],
  options: NormalizedDocsOptions
): string {
  const names = new Set<string>();
  const interfaces: string[] = [];

  for (const doc of docs) {
    if (names.has(doc.generatedName)) {
      throw new Error(
        `[runtypex/docs] Generated interface "${doc.generatedName}" conflicts in ${fileName}.`
      );
    }

    names.add(doc.generatedName);
    interfaces.push(
      generateJSDocFromSpec({
        checker,
        dtoType: doc.dtoType,
        domainType: doc.domainType,
        specNode: doc.specNode,
        options: { name: doc.generatedName, policyMode: options.policyMode },
      })
    );
  }

  return `${interfaces.join("\n\n")}\n`;
}

function _generatedName(domainName: string, sourceSuffix: string): string | null {
  if (!sourceSuffix) return domainName;
  if (!domainName.endsWith(sourceSuffix)) return null;

  const generatedName = domainName.slice(0, -sourceSuffix.length);
  return generatedName || null;
}

function _generatedNameIssue(domainName: string, sourceSuffix: string): string {
  if (!sourceSuffix) return `domain type "${domainName}" does not produce a generated interface name`;
  if (!domainName.endsWith(sourceSuffix)) {
    return `domain type "${domainName}" does not end with "${sourceSuffix}"`;
  }
  return `domain type "${domainName}" would produce an empty generated interface name`;
}

function _typeName(
  checker: ts.TypeChecker,
  type: ts.Type,
  typeNode: ts.TypeNode,
  sourceFile: ts.SourceFile
): string {
  return (
    type.aliasSymbol?.name ??
    type.symbol?.name ??
    checker.typeToString(type, typeNode) ??
    typeNode.getText(sourceFile)
  );
}

function _handleConventionIssue(message: string, mode: "warn" | "error"): void {
  if (mode === "error") throw new Error(message);
  console.warn(message);
}

function _matchesAny(fileName: string, rootDir: string, patterns: string[]): boolean {
  const absolute = _toPosix(path.resolve(fileName));
  const relative = _toPosix(path.relative(rootDir, fileName));

  return patterns.some((pattern) => {
    const normalized = _toPosix(pattern);
    const target = path.isAbsolute(pattern) ? absolute : relative;
    return _globToRegExp(normalized).test(target);
  });
}

function _globToRegExp(pattern: string): RegExp {
  let regex = "^";

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    const next = pattern[i + 1];

    if (char === "*") {
      if (next === "*") {
        const after = pattern[i + 2];
        if (after === "/") {
          regex += "(?:.*/)?";
          i += 2;
        } else {
          regex += ".*";
          i += 1;
        }
      } else {
        regex += "[^/]*";
      }
      continue;
    }

    if (char === "?") {
      regex += "[^/]";
      continue;
    }

    regex += _escapeRegex(char);
  }

  return new RegExp(`${regex}$`);
}

function _escapeRegex(value: string): string {
  return /[\\^$+?.()|[\]{}]/.test(value) ? `\\${value}` : value;
}

function _skip(node: ts.Expression): ts.Expression {
  let expr = node;
  while (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
    expr = expr.expression;
  }
  return expr;
}

function _array<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function _toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}
