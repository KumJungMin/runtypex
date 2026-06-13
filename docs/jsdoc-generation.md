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
interfaces to `runtypex.generated.ts` next to the mapper file.

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
