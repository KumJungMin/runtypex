# Mapper

The mapper feature converts DTO objects into domain objects with a typed mapping
spec. It is useful when API or database field names do not match the names used
inside application code.

## Basic Example

```ts
import { defineMap, makeMapper, source, transform } from "runtypex/mapper";

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

const userMap = defineMap<UserDto, User>()({
  id: source("user_id"),
  displayName: source("profile.name"),
  isActive: transform("status", (value) => value === "ACTIVE"),
});

const toUser = makeMapper<UserDto, User>(userMap);
```

## Type-Level Guarantees

`defineMap<TDto, TDomain>()` checks the mapping spec at compile time:

- every domain field must be present in the mapping spec
- every `source()` or `transform()` path must exist on the DTO type
- transform callbacks can return the final domain field value

This keeps DTO changes visible at compile time instead of letting a rename fail
silently at runtime.

## Runtime Behavior

Without the transformer, `makeMapper()` interprets the mapping spec at runtime:

```ts
const user = toUser(dto);
```

For each domain key, the mapper:

1. reads the DTO value from the configured path
2. applies a default when the source value is missing and a default exists
3. runs the transform callback when one is provided
4. writes the result to the domain output object

The runtime fallback keeps the mapping behavior available without a build
integration:

```ts
const toUser = makeMapper<UserDto, User>(userMap);

toUser({
  user_id: "u1",
  profile: { name: "Lux" },
  status: "ACTIVE",
});
```

At runtime, `makeMapper()` walks the `userMap` object, reads each `from` path
from the input DTO, applies `default` and `transform` when present, and returns
the domain object. It does not create a new source file and it does not inline
generated code.

## Transformer Behavior

With the transformer enabled, this call:

```ts
const toUser = makeMapper<UserDto, User>(userMap);
```

is replaced with an inline mapper function. The generated function can validate
the DTO input before mapping and validate the domain output after mapping.

The transformed source contains code shaped like this:

```ts
const toUser = (function () {
  const S = {
    id: { from: "user_id" },
    displayName: { from: "profile.name" },
    isActive: {
      from: "status",
      transform: (value) => value === "ACTIVE",
    },
  };

  const VD = (input) =>
    typeof input === "object" &&
    input !== null &&
    typeof input.user_id === "string" &&
    typeof input.profile === "object" &&
    input.profile !== null &&
    typeof input.profile.name === "string" &&
    (input.status === "ACTIVE" || input.status === "INACTIVE");

  const VO = (input) =>
    typeof input === "object" &&
    input !== null &&
    typeof input.id === "string" &&
    typeof input.displayName === "string" &&
    typeof input.isActive === "boolean";

  return (input) => {
    if (!VD(input)) throw new TypeError("[runtypex] DTO validation failed.");

    const R = (key, raw) => {
      const rule = S[key];
      const value =
        raw === undefined && Object.prototype.hasOwnProperty.call(rule, "default")
          ? rule.default
          : raw;
      return typeof rule.transform === "function" ? rule.transform(value, input) : value;
    };

    const output = {
      id: R("id", input["user_id"]),
      displayName: R("displayName", input["profile"]["name"]),
      isActive: R("isActive", input["status"]),
    };

    if (!VO(output)) throw new TypeError("[runtypex] Domain validation failed.");
    return output;
  };
})();
```

No separate mapper file is created by the transformer. The mapper function is
inlined into the transformed file that contained `makeMapper<TDto, TDomain>()`.

When `removeInProd: true` is enabled and `NODE_ENV` is `production`, the mapper
itself is still generated, but DTO and domain validation guards are omitted:

```ts
const output = {
  id: R("id", input["user_id"]),
  displayName: R("displayName", input["profile"]["name"]),
  isActive: R("isActive", input["status"]),
};

return output;
```

This gives you one mapping declaration while still allowing build-time optimized
runtime code.

## Metadata

Mapping rules can include metadata:

```ts
id: source("user_id", {
  db: "users.user_id",
  dtoDescription: "Identifier returned by the user API.",
});
```

Metadata is not required for mapping. It is mainly used by JSDoc generation and
documentation tooling. Keep domain field descriptions on the domain type JSDoc;
mapper metadata should describe DTO/database-specific details.

## Typed Helpers

Use `mapperHelpers<TDto>()` when helper callbacks need DTO-aware typing:

```ts
import { mapperHelpers } from "runtypex/mapper";

const h = mapperHelpers<UserDto>();

const userMap = defineMap<UserDto, User>()({
  id: h.source("user_id"),
  displayName: h.source("profile.name"),
  isActive: h.transform("status", (value, dto) => {
    return dto.status === "ACTIVE";
  }),
});
```
