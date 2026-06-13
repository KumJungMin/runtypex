# JSDoc Generation

JSDoc generation creates interface documentation from mapper metadata. It helps
editors show where a domain field came from and which DTO or database field it
represents.

## API

```ts
import { generateJSDocFromSpec } from "runtypex/generator";

const source = generateJSDocFromSpec({
  checker,
  dtoType,
  domainType,
  specNode,
});
```

This API is intended for build tooling that already has access to the TypeScript
program, checker, DTO type, domain type, and mapper spec node.

## Metadata Fields

Mapper metadata can include:

```ts
source("user_id", {
  db: "users.user_id",
  description: "User id",
  dtoDescription: "Identifier returned by the user API.",
});
```

Field meanings:

| Field | Meaning |
| --- | --- |
| `description` | Domain field description. Usually used as the first JSDoc sentence. |
| `dtoDescription` | Optional explanation shown below the DTO path line. |
| `db` | Optional database table and column reference. |

## Generated Output

Given this domain field:

```ts
id: source("user_id", {
  db: "users.user_id",
  description: "User id",
  dtoDescription: "Identifier returned by the user API.",
});
```

the generated documentation can look like this:

```ts
/**
 * User id
 *
 * DTO: UserDto.user_id
 *      Identifier returned by the user API.
 * DTO type: string
 * DB: users.user_id
 * Domain type: string
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
    policy,
    policyMode: "error",
  },
});
```

Use this when generated docs should reflect the same naming rules as runtime and
build-time mapper generation.
