import { getByPath } from "../core/path";

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
  default?: TValue;
};

export type MapRule<TDto, TValue> = MapperMetadata<TValue> & {
  from: PathOf<TDto>;
  transform?: (value: unknown, dto: TDto) => TValue;
};

export type MapSpec<TDto, TDomain> = {
  [K in keyof TDomain]-?: MapRule<TDto, TDomain[K]>;
};

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

export function source<const TPath extends string, TValue = never>(
  from: TPath,
  metadata?: MapperMetadata<TValue>
) {
  return { from, ...metadata };
}

export function transform<const TPath extends string, TValue>(
  from: TPath,
  transform: (value: unknown, dto: any) => TValue,
  metadata?: MapperMetadata<TValue>
) {
  return { from, transform, ...metadata };
}

export function makeMapper<TDto, TDomain>(
  spec: DefinedMap<TDto, TDomain> | MapSpec<TDto, TDomain>
): Mapper<TDto, TDomain> {
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
