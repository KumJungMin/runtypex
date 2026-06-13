# 매핑 정책

매핑 정책은 매퍼 전반에서 DTO 경로와 도메인 필드 이름의 대응을 일관되게
유지합니다. 같은 DTO 필드가 여러 도메인 형태에 등장할 때 유용합니다.


<br/>

## 문제

정책이 없으면 서로 다른 매퍼가 같은 DTO 경로를 서로 다른 이름으로 바꿀 수
있습니다.

```ts
const userMap = defineMap<UserDto, User>()({
  userId: source("user_id"),
});

const auditMap = defineMap<UserDto, AuditUser>()({
  realMemberID: source("user_id"),
});
```

두 매핑은 기술적으로는 모두 유효하지만, 도메인 언어를 일관되지 않게 만듭니다.


<br/>

## 정책 선언

표준 이름을 한 번만 선언합니다.

```ts
import { defineMappingPolicy, source } from "runtypex/mapper";

const userPolicy = defineMappingPolicy<UserDto>()({
  userId: source("user_id"),
});
```

그런 다음 매퍼에 정책을 전달합니다.

```ts
const toAuditUser = makeMapper<UserDto, AuditUser>(auditMap, {
  policy: userPolicy,
  policyMode: "error",
});
```


<br/>

## 모드

`policyMode`는 위반 사항을 처리하는 방식을 제어합니다.

```ts
policyMode: "warn";  // default, logs a warning
policyMode: "error"; // throws an error
```

기존 코드에 정책을 도입하는 동안에는 `"warn"`을 사용합니다. 명명 규칙을 반드시
강제해야 한다면 `"error"`를 사용합니다.


<br/>

## 런타임 및 트랜스포머 검사

정책 검증은 두 경로에서 모두 실행됩니다.

- 런타임 `makeMapper()` 폴백
- 빌드 시점 `makeMapper<TDto, TDomain>()` 트랜스포머 출력

즉, 트랜스포머 설정 여부와 관계없이 정책이 코드를 보호합니다.


<br/>

## 중복 정책 항목

정책 자체는 같은 DTO 경로를 여러 도메인 이름에 매핑하면 안 됩니다.

```ts
const invalidPolicy = defineMappingPolicy<UserDto>()({
  userId: source("user_id"),
  realMemberID: source("user_id"),
});
```

이 경우 `user_id`에 대한 단일 표준 도메인 이름이 없으므로 정책 위반으로
처리됩니다.
