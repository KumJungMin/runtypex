/**
 * runtypex — runtime APIs
 * 1) makeValidate<T>()  : (v) => v is T
 * 2) makeAssert<T>()    : throws on invalid
 *
 * NOTE: These factories are replaced at build-time by the transformer.
 */
export type ValidateFn<T> = (value: unknown) => value is T;

// Replaced by transformer to generated guard
function __validate<T>(_value: unknown): boolean {
  throw new Error("[runtypex] makeValidate() was not transformed. Add the plugin/transformer.");
}

export function makeValidate<T>(): ValidateFn<T> {
  return (value: unknown): value is T => __validate<T>(value);
}

export function makeAssert<T>(): (value: unknown) => asserts value is T {
  const validate = makeValidate<T>();

  return (value: unknown): asserts value is T => {
    if (!validate(value)) throw new TypeError("[runtypex] Validation failed.");
  };
}