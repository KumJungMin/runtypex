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
  plugins: [runtypex({ removeInProd: true })],
});
```

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
            before: [ tsTransformer({ program, removeInProd: true }) ]
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
- 🛠️ **APIs**: `makeValidate`, `makeAssert`
