# Runtime Validation

Runtime validation is the core `runtypex` feature. It turns TypeScript types into
runtime guard functions during build.

## APIs

```ts
import { makeAssert, makeValidate } from "runtypex";
```

`makeValidate<T>()` returns a predicate:

```ts
const isUser = makeValidate<User>();

if (isUser(input)) {
  input.id;
}
```

`makeAssert<T>()` returns an assertion function:

```ts
const assertUser = makeAssert<User>();

assertUser(input);
input.id;
```

## How It Works

You write this:

```ts
interface User {
  id: number;
  name: string;
}

const isUser = makeValidate<User>();
```

The transformer reads the `User` type through the TypeScript type checker and
replaces the call with generated JavaScript:

```js
const isUser = (v) =>
  typeof v === "object" &&
  v !== null &&
  typeof v.id === "number" &&
  typeof v.name === "string";
```

No runtime reflection is required. The generated code is plain JavaScript.

## Build-Time vs Runtime Fallback

`makeValidate<T>()` and `makeAssert<T>()` are useful only as build-time markers
unless the transformer runs. The TypeScript type `T` is erased at runtime, so the
plain runtime fallback cannot inspect it.

### `makeValidate<T>()`

You write:

```ts
const isUser = makeValidate<User>();
```

With the Vite plugin or TypeScript transformer enabled, the call is replaced in
the transformed source file with a generated predicate:

```ts
const isUser = (input) =>
  typeof input === "object" &&
  input !== null &&
  typeof input.id === "number" &&
  typeof input.name === "string";
```

No extra schema file is created. The generated function is inlined into the file
that contained `makeValidate<User>()`.

Without the transformer, the package runtime fallback is used:

```ts
function __validate<T>(_value: unknown): boolean {
  return true;
}

export function makeValidate<T>() {
  return (value: unknown): value is T => __validate<T>(value);
}
```

That fallback is intentionally only a placeholder. It does not validate the
shape of `T`.

### `makeAssert<T>()`

You write:

```ts
const assertUser = makeAssert<User>();
```

With the transformer enabled, the call is replaced with an assertion function
that closes over the generated predicate:

```ts
const assertUser = (function () {
  const G = (input) =>
    typeof input === "object" &&
    input !== null &&
    typeof input.id === "number" &&
    typeof input.name === "string";

  return (input) => {
    if (!G(input)) throw new TypeError("[runtypex] Validation failed.");
  };
})();
```

Without the transformer, `makeAssert<T>()` calls `makeValidate<T>()`, so it uses
the same placeholder fallback and does not validate `T`.

## Production Removal

When `removeInProd: true` is enabled and `NODE_ENV` is `production`,
validators are replaced with no-op equivalents:

```ts
makeValidate<T>(); // (_) => true
makeAssert<T>(); // (_) => {}
```

Use this only when runtime validation is a development-time safety net and not a
production boundary.

## Supported Shape Examples

The current emitter covers common TypeScript shapes:

- primitives
- object and interface properties
- optional properties
- arrays
- tuples
- unions
- intersections
- literal types
- enums

See the emitter tests for exact behavior around edge cases.
