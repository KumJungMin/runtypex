

# 매핑 정책

매핑 정책은 DTO 경로와 도메인 필드 이름의 대응 관계를 일관되게 유지하기 위한 기능입니다.

같은 DTO 필드가 여러 매퍼에서 사용될 때, 매퍼마다 서로 다른 도메인 이름으로 변환하면 코드베이스의 도메인 언어가 흐트러질 수 있습니다. 매핑 정책을 사용하면 특정 DTO 경로에 대해 표준 도메인 필드 이름을 한 번만 정의하고, 이후 매퍼들이 그 규칙을 따르도록 검사할 수 있습니다.

<br/>

## 문제

정책이 없으면 서로 다른 매퍼가 같은 DTO 경로를 서로 다른 이름으로 바꿀 수 있습니다.

```ts
const userMap = defineMap<UserDto, User>()({
  userId: source("user_id"),
});

const auditMap = defineMap<UserDto, AuditUser>()({
  realMemberID: source("user_id"),
});
```

위 두 매핑은 타입 관점에서는 모두 유효합니다.

하지만 같은 DTO 경로인 `user_id`가 한 곳에서는 `userId`, 다른 곳에서는 `realMemberID`로 매핑되고 있습니다.

이런 차이가 쌓이면 다음과 같은 문제가 생길 수 있습니다.

* 같은 개념을 여러 이름으로 부르게 됩니다.
* 도메인 모델 간 일관성이 떨어집니다.
* 새 매퍼를 작성할 때 어떤 이름을 써야 하는지 판단하기 어려워집니다.
* 문서와 타입 이름이 실제 도메인 언어를 안정적으로 반영하지 못합니다.

매핑 정책은 이런 문제를 막기 위해 **DTO 경로별 표준 도메인 이름**을 정의합니다.

<br/>

## 정책 선언하기

먼저 DTO 타입을 기준으로 매핑 정책을 선언합니다.

```ts
import { defineMappingPolicy, source } from "runtypex/mapper";

const userPolicy = defineMappingPolicy<UserDto>()({
  userId: source("user_id"),
});
```

위 정책은 다음 규칙을 의미합니다.

```ts
user_id -> userId
```

즉, `UserDto`의 `user_id` 경로를 도메인 필드로 사용할 때는 `userId`라는 이름을 표준으로 사용하겠다는 뜻입니다.

<br/>

## 매퍼에 정책 적용하기

정책을 선언한 뒤에는 `makeMapper()` 옵션으로 전달합니다.

```ts
const toAuditUser = makeMapper<UserDto, AuditUser>(auditMap, {
  policy: userPolicy,
  policyMode: "error",
});
```

이제 `auditMap`이 정책과 맞지 않는 이름을 사용하면 정책 위반으로 처리됩니다.

예를 들어 정책에서는 `user_id`의 표준 이름을 `userId`로 선언했는데, 매퍼에서 다음과 같이 작성하면:

```ts
const auditMap = defineMap<UserDto, AuditUser>()({
  realMemberID: source("user_id"),
});
```

`user_id`가 `realMemberID`로 매핑되었기 때문에 정책 위반이 됩니다.

정책을 따르려면 다음처럼 작성해야 합니다.

```ts
const auditMap = defineMap<UserDto, AuditUser>()({
  userId: source("user_id"),
});
```

<br/>

## 정책 모드

`policyMode`는 정책 위반을 어떻게 처리할지 결정합니다.

```ts
policyMode: "warn";  // 기본값, 경고를 출력합니다.
policyMode: "error"; // 오류를 발생시킵니다.
```

| 모드        | 동작                | 사용 시점                         |
| --------- | ----------------- | ----------------------------- |
| `"warn"`  | 정책 위반을 경고로 출력합니다. | 기존 코드에 정책을 점진적으로 도입할 때 적합합니다. |
| `"error"` | 정책 위반을 오류로 처리합니다. | 명명 규칙을 반드시 강제해야 할 때 적합합니다.    |

기존 프로젝트에 처음 정책을 도입할 때는 `"warn"`으로 시작하는 것이 좋습니다.

```ts
const toAuditUser = makeMapper<UserDto, AuditUser>(auditMap, {
  policy: userPolicy,
  policyMode: "warn",
});
```

경고를 확인하면서 기존 매퍼를 정리한 뒤, 규칙을 강제할 준비가 되면 `"error"`로 전환할 수 있습니다.

```ts
const toAuditUser = makeMapper<UserDto, AuditUser>(auditMap, {
  policy: userPolicy,
  policyMode: "error",
});
```

<br/>

## 런타임 및 트랜스포머 검사

정책 검증은 다음 두 경로에서 모두 실행됩니다.

* 런타임 `makeMapper()` 폴백
* 빌드 시점 `makeMapper<TDto, TDomain>()` 트랜스포머 출력

즉, 트랜스포머를 사용하지 않는 환경에서도 정책 검증이 동작합니다.

```ts
const toUser = makeMapper<UserDto, User>(userMap, {
  policy: userPolicy,
});
```

트랜스포머가 없는 경우에는 런타임에서 `makeMapper()`가 매핑 명세를 해석하면서 정책을 검사합니다.

반대로 트랜스포머를 활성화한 경우에는 빌드 시점에 인라인 매퍼를 생성하면서 정책 검증이 반영됩니다.

따라서 빌드 연동 여부와 관계없이 같은 정책을 사용할 수 있습니다.

<br/>

## 중복 정책 항목

정책 자체에서도 같은 DTO 경로를 여러 도메인 이름에 매핑하면 안 됩니다.

```ts
const invalidPolicy = defineMappingPolicy<UserDto>()({
  userId: source("user_id"),
  realMemberID: source("user_id"),
});
```

위 정책은 유효하지 않습니다.

`user_id`라는 하나의 DTO 경로에 대해 `userId`와 `realMemberID`라는 두 개의 표준 이름을 선언하고 있기 때문입니다.

매핑 정책의 목적은 DTO 경로별로 하나의 표준 도메인 이름을 정하는 것입니다. 따라서 같은 DTO 경로는 정책 안에서 하나의 이름으로만 선언해야 합니다.

올바른 정책은 다음과 같습니다.

```ts
const userPolicy = defineMappingPolicy<UserDto>()({
  userId: source("user_id"),
});
```

<br/>

## 정리

매핑 정책은 매퍼의 타입 안전성을 넘어, 코드베이스의 도메인 언어를 일관되게 유지하기 위한 장치입니다.

| 항목    | 설명                                          |
| ----- | ------------------------------------------- |
| 목적    | DTO 경로와 도메인 필드 이름의 표준 대응 관계를 정의합니다.         |
| 선언    | `defineMappingPolicy<TDto>()`로 작성합니다.       |
| 적용    | `makeMapper()` 옵션의 `policy`로 전달합니다.         |
| 위반 처리 | `policyMode`로 `"warn"` 또는 `"error"`를 선택합니다. |
| 검사 위치 | 런타임 폴백과 트랜스포머 출력 모두에서 동작합니다.                |
| 제한    | 같은 DTO 경로를 여러 도메인 이름에 매핑할 수 없습니다.           |

이 기능은 여러 매퍼가 같은 DTO를 다루는 프로젝트에서 특히 유용합니다. 같은 원본 필드가 항상 같은 도메인 이름으로 표현되도록 만들어, 매퍼가 늘어나도 도메인 모델의 언어를 안정적으로 유지할 수 있습니다.
