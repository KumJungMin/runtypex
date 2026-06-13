export type PathSegment = string | number;

/** Splits a mapper path into object keys and numeric array indexes. */
export function parsePath(path: string): PathSegment[] {
  if (!path) return [];

  return path.split(".").map((segment) => {
    if (/^(0|[1-9]\d*)$/.test(segment)) return Number(segment);
    return segment;
  });
}

/** Runtime fallback reader used when mapper calls are not transformed. */
export function getByPath(value: unknown, path: string): unknown {
  let current = value as any;

  for (const segment of parsePath(path)) {
    if (current == null) return undefined;
    current = current[segment as any];
  }

  return current;
}

/** Emits bracket-only access for user-authored DTO paths. */
export function emitPathAccess(root: string, path: string): string {
  return parsePath(path).reduce<string>((expr, segment) => {
    if (typeof segment === "number") return `${expr}[${segment}]`;
    return `${expr}[${JSON.stringify(segment)}]`;
  }, root);
}

/** Emits compact dot access when safe, with bracket fallback for quoted keys. */
export function emitPropertyAccess(root: string, property: string | number): string {
  if (typeof property === "number") return `${root}[${property}]`;
  if (/^[A-Za-z_$][\w$]*$/.test(property)) return `${root}.${property}`;
  return `${root}[${JSON.stringify(property)}]`;
}
