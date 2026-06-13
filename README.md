# 🛡️ runtypex

Runtime type guards compiled from your TypeScript types.  
No schemas. No decorators. Just types → blazing-fast runtime checks.


## Use
```ts
import { makeValidate, makeAssert } from "runtypex";

interface User { id: number; name: string; active: boolean; }

const isUser = makeValidate<User>();
const assertUser: ReturnType<typeof makeAssert<User>> = makeAssert<User>();

isUser({ id: 1, name: "Lux", active: true });  // true
assertUser({ id: "bad" });                      // throws
toUser({ nope: true });                         // → fallback
```

## Vite
```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vitePlugin as runtypex } from "runtypex";

export default defineConfig({
  plugins: [runtypex()],
});
```

To disable runtime checks in production builds, pass the option `{ removeInProd: true }` when initializing the Vite plugin.
```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vitePlugin as runtypex } from "runtypex";

export default defineConfig({
  plugins: [runtypex({ removeInProd: true })],
});
```

## Mapper
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
  id: source("user_id", {
    db: "users.user_id",
    description: "User id",
  }),
  displayName: source("profile.name"),
  isActive: transform("status", (value) => value === "ACTIVE"),
});

const toUser = makeMapper<UserDto, User>(userMap);
```

`defineMap<TDto, TDomain>()` checks that every domain field is mapped and that `from` paths exist on the DTO type. `makeMapper()` also has a runtime fallback, and the transformer can inline it with DTO and domain validation.
Use `mapperHelpers<TDto>()` when helper callbacks need typed access to the source DTO.

## JSDoc generation
```ts
import { generateJSDocFromSpec } from "runtypex/generator";

const source = generateJSDocFromSpec({
  checker,
  dtoType,
  domainType,
  specNode,
});
```

The generated interface includes mapper metadata such as DTO path, DTO type, DB column, description, and domain type, so editors can show the source information on hover.

## Webpack (ts-loader)
```js
// webpack.config.js
const { tsTransformer } = require("runtypex/dist/ts-transformer.js");

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          getCustomTransformers: (program) => ({
            before: [ tsTransformer({ program }) ]
          })
        }
      }
    ]
  }
}
```

## Why runtypex?
- ⚡ **Fast**: compiled checks, no runtime schema walk
- 🧩 **Simple**: types only, no schema duplication
- 🧱 **Flexible**: Vite or Webpack
- 🛠️ **APIs**: `makeValidate`, `makeAssert`, `defineMap`, `makeMapper`
