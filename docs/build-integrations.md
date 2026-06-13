# Build Integrations

`runtypex` relies on the TypeScript compiler API, so its full value comes from
running the transformer during build.

## Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vitePlugin as runtypex } from "runtypex";

export default defineConfig({
  plugins: [runtypex()],
});
```

The Vite plugin scans TypeScript files for:

- `makeValidate<T>()`
- `makeAssert<T>()`
- `makeMapper<TDto, TDomain>()`

When a target call is found, the plugin creates a TypeScript program for the
nearest `tsconfig.json`, runs the transformer, and returns the transformed code
to Vite.

The Vite plugin can also generate mapper documentation by convention:

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

For each included mapper file, runtypex finds declarations like:

```ts
export const addressMap = defineMap<
  SearchAddressDto,
  SearchAddressDomainSource
>()({
  id: source("RESULT.ID"),
});
```

It generates `SearchAddressDomain` by removing the `Source` suffix and writes
all generated interfaces for the same folder to `runtypex.generated.ts`.

Docs options:

| Option | Default | Description |
| --- | --- | --- |
| `include` | `**/*.mapper.ts`, `**/*.mapper.tsx` | Mapper files to scan, relative to the Vite root. |
| `exclude` | generated file name | Files to skip. |
| `sourceSuffix` | `Source` | Domain type suffix removed for the generated interface name. |
| `generatedFileName` | `runtypex.generated.ts` | File written next to each mapper file. |
| `outDir` | `near-source` | Currently only near-source generation is supported. |
| `policyMode` | `warn` | Use `error` to fail when a mapper violates docs conventions. |

## ts-loader

```js
// webpack.config.js
const { tsTransformer } = require("runtypex");

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          getCustomTransformers: (program) => ({
            before: [tsTransformer({ program })],
          }),
        },
      },
    ],
  },
};
```

## Transformer Options

```ts
tsTransformer({
  program,
  removeInProd: true,
  validateDto: true,
  validateDomain: true,
});
```

| Option | Default | Description |
| --- | --- | --- |
| `program` | required | TypeScript program used to resolve types. |
| `removeInProd` | `false` | Replaces generated validation with no-op functions in production. |
| `validateDto` | `true` | Enables DTO input validation for generated mappers. |
| `validateDomain` | `true` | Enables domain output validation for generated mappers. |

## Package Entry Points

```ts
import { makeValidate } from "runtypex";
import { makeMapper } from "runtypex/mapper";
import { generateJSDocFromSpec } from "runtypex/generator";
import { tsTransformer } from "runtypex/transformer";
import { vitePlugin } from "runtypex/transformer/vite-plugin";
```

The package exports ESM and CommonJS builds from `dist/esm` and `dist/cjs`.

## Local Verification

Useful verification commands:

```bash
npm run build
npx jest --runInBand --watchman=false
npm run test:esm
```
