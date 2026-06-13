import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "@jest/globals";
import vitePlugin from "../src/transformer/vite-plugin";

const tempDirs: string[] = [];

function createProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "runtypex-docs-"));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, "src/features/address"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ESNext",
        module: "ESNext",
        strict: true,
        skipLibCheck: true,
      },
      include: ["src"],
    })
  );
  return root;
}

function writeFile(root: string, fileName: string, content: string): void {
  const absolute = path.join(root, fileName);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, content);
}

function runDocs(root: string, docs: Exclude<Parameters<typeof vitePlugin>[0], undefined>["docs"]): void {
  const plugin = vitePlugin({ docs }) as any;
  plugin.configResolved?.({ root });
  plugin.buildStart?.();
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("vitePlugin docs generation", () => {
  it("generates near-source JSDoc interfaces from included mapper files", () => {
    const root = createProject();
    writeFile(
      root,
      "src/features/address/address.mapper.ts",
      `
        interface SearchAddressDto {
          RESULT: { ID: string; TITLE: string };
        }

        export interface SearchAddressDomainSource {
          /** Address id */
          id: string;
          title: string;
        }

        export const addressMap = defineMap<
          SearchAddressDto,
          SearchAddressDomainSource
        >()({
          id: source("RESULT.ID", {
            db: "address.id",
            dtoDescription: "Address identifier from the API response.",
          }),
          title: source("RESULT.TITLE"),
        });

        export interface SearchAddressSummarySource {
          /** Display title */
          title: string;
        }

        export const addressSummaryMap = defineMap<
          SearchAddressDto,
          SearchAddressSummarySource
        >()({
          title: source("RESULT.TITLE"),
        });
      `
    );

    runDocs(root, { include: "src/features/**/*.mapper.ts" });

    const generated = fs.readFileSync(
      path.join(root, "src/features/address/runtypex.generated.ts"),
      "utf8"
    );

    expect(generated).toContain("export interface SearchAddressDomain");
    expect(generated).toContain("* Address id");
    expect(generated).toContain("* DTO: SearchAddressDto.RESULT.ID");
    expect(generated).toContain("*      Address identifier from the API response.");
    expect(generated).toContain("* DB: address.id");
    expect(generated).toContain("title: string;");
    expect(generated).toContain("export interface SearchAddressSummary");
    expect(generated).toContain("* Display title");
    expect(generated).not.toContain("SearchAddressDomainSource");
  });

  it("fails when policyMode is error and a domain type does not use the source suffix", () => {
    const root = createProject();
    writeFile(
      root,
      "src/features/address/address.mapper.ts",
      `
        interface SearchAddressDto {
          RESULT: { ID: string };
        }

        interface SearchAddressDomain {
          id: string;
        }

        export const addressMap = defineMap<
          SearchAddressDto,
          SearchAddressDomain
        >()({
          id: source("RESULT.ID"),
        });
      `
    );

    expect(() =>
      runDocs(root, {
        include: "src/features/**/*.mapper.ts",
        policyMode: "error",
      })
    ).toThrow('domain type "SearchAddressDomain" does not end with "Source"');
  });

  it("supports custom source suffix and generated file name", () => {
    const root = createProject();
    writeFile(
      root,
      "src/features/address/address.mapper.ts",
      `
        interface SearchAddressDto {
          RESULT: { ID: string };
        }

        interface SearchAddressDomainShape {
          /** Address id */
          id: string;
        }

        export const addressMap = defineMap<
          SearchAddressDto,
          SearchAddressDomainShape
        >()({
          id: source("RESULT.ID"),
        });
      `
    );

    runDocs(root, {
      include: "src/features/**/*.mapper.ts",
      sourceSuffix: "Shape",
      generatedFileName: "addressMap.generated.ts",
    });

    const generated = fs.readFileSync(
      path.join(root, "src/features/address/addressMap.generated.ts"),
      "utf8"
    );

    expect(generated).toContain("export interface SearchAddressDomain");
    expect(generated).toContain("* DTO: SearchAddressDto.RESULT.ID");
  });

  it("fails on generated interface name collisions in the same output file", () => {
    const root = createProject();
    writeFile(
      root,
      "src/features/address/address.mapper.ts",
      `
        interface SearchAddressDtoA {
          RESULT: { ID: string };
        }

        interface SearchAddressDomainSource {
          id: string;
        }

        export const addressMap = defineMap<
          SearchAddressDtoA,
          SearchAddressDomainSource
        >()({
          id: source("RESULT.ID"),
        });
      `
    );
    writeFile(
      root,
      "src/features/address/address-alt.mapper.ts",
      `
        interface SearchAddressDtoB {
          RESULT: { ALT_ID: string };
        }

        interface SearchAddressDomainSource {
          id: string;
        }

        export const addressAliasMap = defineMap<
          SearchAddressDtoB,
          SearchAddressDomainSource
        >()({
          id: source("RESULT.ALT_ID"),
        });
      `
    );

    expect(() => runDocs(root, { include: "src/features/**/*.mapper.ts" })).toThrow(
      'Generated interface "SearchAddressDomain" conflicts'
    );
  });

  it("rejects an empty generated interface name when only the suffix remains", () => {
    const root = createProject();
    writeFile(
      root,
      "src/features/address/address.mapper.ts",
      `
        interface SearchAddressDto {
          RESULT: { ID: string };
        }

        interface Source {
          id: string;
        }

        export const addressMap = defineMap<
          SearchAddressDto,
          Source
        >()({
          id: source("RESULT.ID"),
        });
      `
    );

    expect(() =>
      runDocs(root, {
        include: "src/features/**/*.mapper.ts",
        policyMode: "error",
      })
    ).toThrow('domain type "Source" would produce an empty generated interface name');
  });
});
