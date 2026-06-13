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
