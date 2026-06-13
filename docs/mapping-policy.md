# Mapping Policy

Mapping policy keeps DTO path to domain field naming consistent across mappers.
It is useful when the same DTO field appears in multiple domain shapes.

## Problem

Without a policy, different mappers can rename the same DTO path differently:

```ts
const userMap = defineMap<UserDto, User>()({
  userId: source("user_id"),
});

const auditMap = defineMap<UserDto, AuditUser>()({
  realMemberID: source("user_id"),
});
```

Both mappings are technically valid, but they make the domain language
inconsistent.

## Policy Declaration

Declare the canonical name once:

```ts
import { defineMappingPolicy, source } from "runtypex/mapper";

const userPolicy = defineMappingPolicy<UserDto>()({
  userId: source("user_id"),
});
```

Then pass the policy into a mapper:

```ts
const toAuditUser = makeMapper<UserDto, AuditUser>(auditMap, {
  policy: userPolicy,
  policyMode: "error",
});
```

## Modes

`policyMode` controls how violations are handled:

```ts
policyMode: "warn";  // default, logs a warning
policyMode: "error"; // throws an error
```

Use `"warn"` while introducing a policy into existing code. Use `"error"` when
the naming convention should be enforced.

## Runtime And Transformer Checks

Policy validation runs in both paths:

- runtime `makeMapper()` fallback
- build-time `makeMapper<TDto, TDomain>()` transformer emission

That means the policy protects code whether or not the transformer is currently
configured.

## Duplicate Policy Entries

The policy itself must not map the same DTO path to multiple domain names:

```ts
const invalidPolicy = defineMappingPolicy<UserDto>()({
  userId: source("user_id"),
  realMemberID: source("user_id"),
});
```

This is treated as a policy violation because there is no single canonical
domain name for `user_id`.
