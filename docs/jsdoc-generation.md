# JSDoc Generation

JSDoc generation creates interface documentation from mapper metadata. It helps
editors show where a domain field came from and which DTO or database field it
represents.

## Vite Convention

```ts
import { defineConfig } from "vite";
import { vitePlugin as runtypex } from "runtypex";

export default defineConfig({
  plugins: [
    runtypex({
      docs: {
        include: "src/features/**/*.mapper.ts",
      },
    }),
  ],
});
```

The plugin finds `defineMap<TDto, TDomainSource>()(...)` calls in included mapper
files, removes the `Source` suffix from `TDomainSource`, and writes generated
interfaces next to the mapper file. By default, interfaces in the same folder are
merged into `runtypex.generated.ts`.

## Build-Time vs No Build Integration

Docs generation runs from the Vite plugin `buildStart` hook. It is not a runtime
API and it does not change application code.

With `docs.include` configured, each matching mapper file is scanned during the
build:

```ts
// src/features/address/address.mapper.ts
export interface SearchAddressDomainSource {
  /** Address id */
  id: string;
}

export const addressMap = defineMap<
  SearchAddressDto,
  SearchAddressDomainSource
>()({
  id: source("RESULT.ID", {
    db: "address.id",
    dtoDescription: "Address identifier from the API response.",
  }),
});
```

The plugin writes a generated file next to the mapper file:

```ts
// src/features/address/runtypex.generated.ts
export interface SearchAddressDomain {
  /**
   * Address id
   *
   * - DTO: `SearchAddressDto.RESULT.ID`
   * - DTO description: Address identifier from the API response.
   * - DTO type: `string`
   * - Origin: `address.id`
   * - Domain type: `string`
   */
  id: string;
}
```

No application runtime code is emitted for docs generation. The only output is
the generated `.ts` documentation file.

Without `docs` configured, or without running the Vite plugin, no docs file is
created. Mapper files remain unchanged, and `generateJSDocFromSpec()` is only
available as a manual build-tool API.

## Generated File Names

The default generated file name is `runtypex.generated.ts`:

```ts
runtypex({
  docs: {
    include: "src/features/**/*.mapper.ts",
  },
});
```

Use `generatedFileName` as a string when every included mapper in the same folder
should merge into the same custom file:

```ts
runtypex({
  docs: {
    include: "src/features/**/*.mapper.ts",
    generatedFileName: "domain.generated.ts",
  },
});
```

Use `generatedFileName` as a function when the output should follow the source
mapper file name:

```ts
runtypex({
  docs: {
    include: "src/features/**/*.mapper.ts",
    generatedFileName: ({ sourceFileBaseName }) =>
      sourceFileBaseName.replace(/\.mapper\.ts$/, ".generated.ts"),
  },
});
```

For `src/features/addressSearch/addressSearch.mapper.ts`, this writes
`src/features/addressSearch/addressSearch.generated.ts`.

Docs are grouped by the resolved generated file name. If two mapper files resolve
to the same generated file, their interfaces are merged. If that merged file
would contain the same generated interface name twice, docs generation keeps the
existing conflict error.

When `generatedFileName` is a function, runtypex excludes `**/*.generated.ts` by
default. If your resolver writes a different pattern, pass `exclude` explicitly.

## Manual API

```ts
import { generateJSDocFromSpec } from "runtypex/generator";

const source = generateJSDocFromSpec({
  checker,
  dtoType,
  domainType,
  specNode,
});
```

This lower-level API is intended for build tooling that already has access to
the TypeScript program, checker, DTO type, domain type, and mapper spec node.

## Metadata Sources

Domain field descriptions should live on the domain type:

```ts
interface User {
  /** User id */
  id: string;
}
```

Mapper metadata can include source-specific details:

```ts
source("user_id", {
  db: "users.user_id",
  dtoDescription: "Identifier returned by the user API.",
});
```

Field meanings:

| Field | Meaning |
| --- | --- |
| Domain property JSDoc | Domain field description. Usually used as the first JSDoc sentence. |
| `dtoDescription` | Optional explanation shown as the `DTO description` bullet. |
| `db` | Optional origin field shown as the `Origin` bullet. |

For older mapper specs, `description` is still read as a fallback when the
domain property has no JSDoc. New code should prefer domain property JSDoc so
the domain description is not duplicated per DTO mapping.

## Generated Output

Given this domain field and mapping:

```ts
interface User {
  /** User id */
  id: string;
}

id: source("user_id", {
  db: "users.user_id",
  dtoDescription: "Identifier returned by the user API.",
});
```

the generated documentation can look like this:

```ts
/**
 * User id
 *
 * - DTO: `UserDto.user_id`
 * - DTO description: Identifier returned by the user API.
 * - DTO type: `string`
 * - Origin: `users.user_id`
 * - Domain type: `string`
 */
id: string;
```

## Policy Integration

JSDoc generation can also receive mapper policy options. This lets documentation
generation fail or warn when the spec violates canonical DTO path naming:

```ts
generateJSDocFromSpec({
  checker,
  dtoType,
  domainType,
  specNode,
  options: {
    mappingPolicy: policy,
    policyMode: "error",
  },
});
```

Use this when generated docs should reflect the same naming rules as runtime and
build-time mapper generation.
