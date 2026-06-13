import { getByPath } from "../core/path.js";

type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | Date;

export type PathOf<T> = T extends Primitive
  ? never
  : T extends readonly (infer U)[]
    ? `${number}` | `${number}.${PathOf<U>}`
    : {
        [K in Extract<keyof T, string>]: T[K] extends Primitive
          ? K
          : T[K] extends readonly (infer U)[]
            ? K | `${K}.${number}` | `${K}.${number}.${PathOf<U>}`
            : K | `${K}.${PathOf<T[K]>}`;
      }[Extract<keyof T, string>];

export type Mapper<TDto, TDomain> = (dto: TDto) => TDomain;

export type MapperMetadata<TValue = never> = {
  db?: string;
  description?: string;
  dtoDescription?: string;
  default?: TValue;
};

export type MapRule<TDto, TValue> = MapperMetadata<TValue> & {
  from: PathOf<TDto>;
  transform?: (value: unknown, dto: TDto) => TValue;
};

export type MapSpec<TDto, TDomain> = {
  [K in keyof TDomain]-?: MapRule<TDto, TDomain[K]>;
};

export type MappingPolicy<TDto> = Record<string, MapRule<TDto, unknown>>;
export type MappingPolicyMode = "warn" | "error";
export type MapperOptions<TDto> = {
  policy?: MappingPolicy<TDto>;
  policyMode?: MappingPolicyMode;
};

// Phantom fields preserve DTO/Domain generic information for makeMapper inference.
declare const DTO_TYPE: unique symbol;
declare const DOMAIN_TYPE: unique symbol;

export type DefinedMap<TDto, TDomain> = MapSpec<TDto, TDomain> & {
  readonly [DTO_TYPE]?: TDto;
  readonly [DOMAIN_TYPE]?: TDomain;
};

export function defineMap<TDto, TDomain>() {
  return <const TSpec extends MapSpec<TDto, TDomain>>(spec: TSpec) =>
    spec as TSpec & DefinedMap<TDto, TDomain>;
}

/** Declares canonical DTO path -> Domain field names for consistency checks. */
export function defineMappingPolicy<TDto>() {
  return <const TSpec extends MappingPolicy<TDto>>(spec: TSpec) => spec;
}

/** Shorthand rule for direct DTO path reads. */
export function source<const TPath extends string, TValue = never>(
  from: TPath,
  metadata?: MapperMetadata<TValue>
) {
  return { from, ...metadata };
}

/** Shorthand rule for DTO path reads that require a value conversion. */
export function transform<const TPath extends string, TValue>(
  from: TPath,
  transform: (value: unknown, dto: unknown) => TValue,
  metadata?: MapperMetadata<TValue>
) {
  return { from, transform, ...metadata };
}

/** Typed helpers for callbacks that need access to the source DTO shape. */
export function mapperHelpers<TDto>() {
  return {
    source: <const TPath extends PathOf<TDto>, TValue = never>(
      from: TPath,
      metadata?: MapperMetadata<TValue>
    ) => source(from, metadata),
    transform: <const TPath extends PathOf<TDto>, TValue>(
      from: TPath,
      transform: (value: unknown, dto: TDto) => TValue,
      metadata?: MapperMetadata<TValue>
    ) => ({ from, transform, ...metadata }),
  };
}

/** Runtime interpreter used as fallback when the transformer is not configured. */
export function makeMapper<TDto, TDomain>(
  spec: DefinedMap<TDto, TDomain> | MapSpec<TDto, TDomain>,
  options?: MapperOptions<TDto>
): Mapper<TDto, TDomain> {
  _handlePolicyViolations(_findPolicyViolations(spec, options?.policy), options?.policyMode ?? "warn");

  return ((dto: TDto) => {
    const output: Record<string, unknown> = {};

    for (const key of Object.keys(spec)) {
      const rule = (spec as Record<string, MapRule<TDto, unknown>>)[key];
      const raw = getByPath(dto, String(rule.from));
      const value = raw === undefined && _hasOwn(rule, "default") ? rule.default : raw;

      output[key] = rule.transform ? rule.transform(value, dto) : value;
    }

    return output as TDomain;
  }) as Mapper<TDto, TDomain>;
}

function _hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function _findPolicyViolations<TDto>(
  spec: MapSpec<TDto, any>,
  policy: MappingPolicy<TDto> | undefined
): string[] {
  if (!policy) return [];

  const canonicalByPath = new Map<string, string>();
  const violations: string[] = [];

  for (const key of Object.keys(policy)) {
    const from = String(policy[key].from);
    const existing = canonicalByPath.get(from);
    if (existing && existing !== key) {
      violations.push(`DTO path "${from}" is canonically mapped as "${existing}", but this map uses "${key}".`);
      continue;
    }
    canonicalByPath.set(from, key);
  }

  violations.push(...Object.keys(spec).flatMap((key) => {
    const from = String((spec as Record<string, MapRule<TDto, unknown>>)[key].from);
    const expected = canonicalByPath.get(from);
    return expected && expected !== key
      ? [`DTO path "${from}" is canonically mapped as "${expected}", but this map uses "${key}".`]
      : [];
  }));

  return violations;
}

function _handlePolicyViolations(violations: string[], mode: MappingPolicyMode): void {
  if (!violations.length) return;

  const message = `[runtypex/mapper] Mapping policy violation:\n${violations.join("\n")}`;
  if (mode === "error") throw new Error(message);
  console.warn(message);
}
