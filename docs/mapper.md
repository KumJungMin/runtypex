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

## Transformer Behavior

With the transformer enabled, this call:

```ts
const toUser = makeMapper<UserDto, User>(userMap);
```

is replaced with an inline mapper function. The generated function can validate
the DTO input before mapping and validate the domain output after mapping.

This gives you one mapping declaration while still allowing build-time optimized
runtime code.

## Metadata

Mapping rules can include metadata:

```ts
id: source("user_id", {
  db: "users.user_id",
  description: "User id",
  dtoDescription: "Identifier returned by the user API.",
});
```

Metadata is not required for mapping. It is mainly used by JSDoc generation and
documentation tooling.

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
