# runtypex

`runtypex` generates runtime validation and mapping code from TypeScript types.
It keeps TypeScript types as the source of truth, so you do not need to maintain
a separate schema just to validate data at runtime.

## What It Solves

TypeScript types disappear after compilation. That means data from APIs,
databases, files, or external modules can still be invalid at runtime even when
the consuming code is type-safe at build time.

`runtypex` closes that gap by using the TypeScript compiler API to generate
runtime guards and mappers during build.

## Install

```bash
npm i runtypex
```

## Quick Start

```ts
import { makeAssert, makeValidate } from "runtypex";

interface User {
  id: number;
  name: string;
  active: boolean;
}

const isUser = makeValidate<User>();
const assertUser = makeAssert<User>();

isUser({ id: 1, name: "Lux", active: true }); // true
assertUser({ id: "bad" }); // throws
```

## Vite Setup

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vitePlugin as runtypex } from "runtypex";

export default defineConfig({
  plugins: [runtypex()],
});
```

To replace validators with no-op functions in production builds:

```ts
export default defineConfig({
  plugins: [runtypex({ removeInProd: true })],
});
```

To generate mapper documentation by convention:

```ts
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

The docs generator finds `defineMap<TDto, TDomainSource>()(...)` calls under the
included files, removes the `Source` suffix, and writes generated interfaces to
`runtypex.generated.ts` next to the mapper file.

## Feature Docs

| Feature | Description |
| --- | --- |
| [Runtime validation](docs/runtime-validation.md) | Generate `makeValidate<T>()` and `makeAssert<T>()` implementations from TypeScript types. |
| [Mapper](docs/mapper.md) | Convert DTO shapes into domain shapes with typed mapping specs. |
| [Mapping policy](docs/mapping-policy.md) | Keep DTO path to domain field names consistent across multiple mappers. |
| [JSDoc generation](docs/jsdoc-generation.md) | Generate field documentation from domain JSDoc and mapper metadata. |
| [Build integrations](docs/build-integrations.md) | Configure Vite, ts-loader, ESM exports, and build behavior. |

## Mapper Example

```ts
import { defineMap, makeMapper, source, transform } from "runtypex/mapper";

interface UserDto {
  user_id: string;
  profile: { name: string };
  status: "ACTIVE" | "INACTIVE";
}

interface UserSource {
  /** User id */
  id: string;
  displayName: string;
  isActive: boolean;
}

const userMap = defineMap<UserDto, UserSource>()({
  id: source("user_id", {
    db: "users.user_id",
    dtoDescription: "User identifier from the user DTO.",
  }),
  displayName: source("profile.name"),
  isActive: transform("status", (value) => value === "ACTIVE"),
});

const toUser = makeMapper<UserDto, UserSource>(userMap);
```

## Why runtypex?

| Goal | How runtypex handles it |
| --- | --- |
| Avoid schema duplication | Runtime code is generated from TypeScript types. |
| Validate external data | Generated guards check values after compilation. |
| Keep DTO and domain mapping explicit | Mapper specs make field movement visible and typed. |
| Reduce runtime overhead | Build-time generation avoids dynamic schema parsing. |

## Demo

[runtypex-demo](https://github.com/KumJungMin/runtypex-demo) shows TypeScript
types being transformed into runtime guards during build.
