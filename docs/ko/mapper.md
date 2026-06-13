

# 매퍼

`runtypex`의 매퍼는 타입이 지정된 매핑 명세를 사용해 DTO 객체를 도메인 객체로 변환합니다.

API 응답, 데이터베이스 레코드, 외부 시스템의 필드 이름이 애플리케이션 내부에서 사용하는 도메인 모델과 다를 때 유용합니다.

예를 들어 DTO에서는 `user_id`라는 필드를 사용하지만, 애플리케이션 내부에서는 `id`라는 이름을 사용하고 싶을 수 있습니다. 이런 경우 매퍼를 사용하면 필드 이름 변환, 중첩 필드 접근, 값 변환을 하나의 명세로 관리할 수 있습니다.

<br/>

## 기본 예제

```ts
import { defineMap, makeMapper, source, transform } from "runtypex/mapper";

interface UserDto {
  user_id: string;
  profile: { name: string };
  status: "ACTIVE" | "INACTIVE";
}

interface User {
  id: string;
  displayName: string;
  isActive: boolean;
}

const userMap = defineMap<UserDto, User>()({
  id: source("user_id"),
  displayName: source("profile.name"),
  isActive: transform("status", (value) => value === "ACTIVE"),
});

const toUser = makeMapper<UserDto, User>(userMap);
```

위 매퍼는 `UserDto`를 받아 다음과 같은 `User` 객체로 변환합니다.

```ts
const user = toUser({
  user_id: "u1",
  profile: { name: "Lux" },
  status: "ACTIVE",
});
```

결과는 다음과 같습니다.

```ts
{
  id: "u1",
  displayName: "Lux",
  isActive: true
}
```

<br/>

## 매핑 명세 작성하기

매핑 명세는 `defineMap<TDto, TDomain>()`으로 정의합니다.

```ts
const userMap = defineMap<UserDto, User>()({
  id: source("user_id"),
  displayName: source("profile.name"),
  isActive: transform("status", (value) => value === "ACTIVE"),
});
```

각 도메인 필드는 다음 방식으로 매핑할 수 있습니다.

| 헬퍼                          | 용도                                |
| --------------------------- | --------------------------------- |
| `source(path)`              | DTO의 특정 경로에서 값을 그대로 가져옵니다.        |
| `transform(path, callback)` | DTO의 특정 경로에서 값을 가져온 뒤 콜백으로 변환합니다. |

예를 들어:

```ts
id: source("user_id")
```

는 DTO의 `user_id` 값을 도메인 객체의 `id` 필드에 넣습니다.

```ts
displayName: source("profile.name")
```

는 DTO의 중첩 필드인 `profile.name` 값을 도메인 객체의 `displayName` 필드에 넣습니다.

```ts
isActive: transform("status", (value) => value === "ACTIVE")
```

는 DTO의 `status` 값을 읽은 뒤, 도메인 객체에서 사용할 `boolean` 값으로 변환합니다.

<br/>

## 타입 레벨 보장

`defineMap<TDto, TDomain>()`은 컴파일 시점에 매핑 명세를 검사합니다.

다음 조건이 타입 레벨에서 확인됩니다.

* 모든 도메인 필드가 매핑 명세에 포함되어야 합니다.
* `source()` 또는 `transform()`에 전달한 경로는 DTO 타입에 존재해야 합니다.
* `transform()` 콜백은 최종 도메인 필드에 할당 가능한 값을 반환해야 합니다.

덕분에 DTO 구조가 바뀌었을 때 런타임에서 조용히 실패하는 대신, 컴파일 시점에 문제를 발견할 수 있습니다.

예를 들어 DTO에서 `user_id`가 제거되었는데 매퍼가 여전히 다음과 같이 작성되어 있다면:

```ts
id: source("user_id")
```

TypeScript가 매핑 경로 오류를 감지할 수 있습니다.

<br/>

## 런타임 동작

트랜스포머를 사용하지 않아도 `makeMapper()`는 런타임에서 매핑 명세를 해석해 동작합니다.

```ts
const toUser = makeMapper<UserDto, User>(userMap);

const user = toUser({
  user_id: "u1",
  profile: { name: "Lux" },
  status: "ACTIVE",
});
```

런타임에서 매퍼는 각 도메인 필드에 대해 다음 순서로 동작합니다.

1. 매핑 명세에 설정된 DTO 경로에서 값을 읽습니다.
2. 소스 값이 `undefined`이고 `default` 값이 있으면 `default`를 적용합니다.
3. `transform` 콜백이 있으면 값을 변환합니다.
4. 결과를 도메인 출력 객체에 기록합니다.

즉, 위 예제에서는 다음과 같은 작업이 일어납니다.

| 도메인 필드        | DTO 경로         | 처리 방식                             |
| ------------- | -------------- | --------------------------------- |
| `id`          | `user_id`      | 값을 그대로 복사합니다.                     |
| `displayName` | `profile.name` | 중첩 값을 읽어 복사합니다.                   |
| `isActive`    | `status`       | `"ACTIVE"` 여부를 `boolean`으로 변환합니다. |

런타임 폴백은 별도의 빌드 연동 없이도 매퍼 기능을 사용할 수 있게 해줍니다.

이 모드에서 `makeMapper()`는 `userMap` 객체를 순회하고, 입력 DTO에서 각 `from` 경로를 읽은 뒤, 필요한 경우 `default`와 `transform`을 적용해 도메인 객체를 반환합니다.

새 소스 파일을 만들지 않으며, 생성 코드를 인라인하지도 않습니다.

<br/>

## 트랜스포머 동작

트랜스포머를 활성화하면 다음 호출은:

```ts
const toUser = makeMapper<UserDto, User>(userMap);
```

빌드 시점에 인라인 매퍼 함수로 대체됩니다.

생성된 함수는 설정에 따라 다음 검증을 포함할 수 있습니다.

* 매핑 전 DTO 입력 검증
* 매핑 후 도메인 출력 검증

변환된 소스에는 다음과 같은 형태의 코드가 포함됩니다.

```ts
const toUser = (function () {
  const S = {
    id: { from: "user_id" },
    displayName: { from: "profile.name" },
    isActive: {
      from: "status",
      transform: (value) => value === "ACTIVE",
    },
  };

  const VD = (input) =>
    typeof input === "object" &&
    input !== null &&
    typeof input.user_id === "string" &&
    typeof input.profile === "object" &&
    input.profile !== null &&
    typeof input.profile.name === "string" &&
    (input.status === "ACTIVE" || input.status === "INACTIVE");

  const VO = (input) =>
    typeof input === "object" &&
    input !== null &&
    typeof input.id === "string" &&
    typeof input.displayName === "string" &&
    typeof input.isActive === "boolean";

  return (input) => {
    if (!VD(input)) throw new TypeError("[runtypex] DTO validation failed.");

    const R = (key, raw) => {
      const rule = S[key];
      const value =
        raw === undefined && Object.prototype.hasOwnProperty.call(rule, "default")
          ? rule.default
          : raw;

      return typeof rule.transform === "function"
        ? rule.transform(value, input)
        : value;
    };

    const output = {
      id: R("id", input["user_id"]),
      displayName: R("displayName", input["profile"]["name"]),
      isActive: R("isActive", input["status"]),
    };

    if (!VO(output)) {
      throw new TypeError("[runtypex] Domain validation failed.");
    }

    return output;
  };
})();
```

트랜스포머는 별도의 매퍼 파일을 만들지 않습니다.

대신 `makeMapper<TDto, TDomain>()` 호출이 있던 파일 안에 매퍼 함수를 인라인합니다. 이 방식은 하나의 매핑 선언을 유지하면서도, 빌드 시점에 최적화된 런타임 코드를 얻을 수 있게 해줍니다.

<br/>

## 프로덕션 빌드에서 검증 제거하기

트랜스포머 옵션에서 `removeInProd: true`를 활성화하고 `NODE_ENV`가 `production`이면, 매퍼 자체는 계속 생성되지만 DTO 및 도메인 검증 가드는 제거됩니다.

즉, 다음과 같은 검증 코드는 프로덕션 빌드에서 빠질 수 있습니다.

```ts
if (!VD(input)) {
  throw new TypeError("[runtypex] DTO validation failed.");
}

if (!VO(output)) {
  throw new TypeError("[runtypex] Domain validation failed.");
}
```

검증이 제거된 매퍼는 매핑 결과를 바로 반환합니다.

```ts
const output = {
  id: R("id", input["user_id"]),
  displayName: R("displayName", input["profile"]["name"]),
  isActive: R("isActive", input["status"]),
};

return output;
```

이 옵션은 개발 및 테스트 환경에서는 검증을 유지하고, 프로덕션 환경에서는 런타임 비용을 줄이고 싶을 때 사용할 수 있습니다.

<br/>

## 메타데이터

매핑 규칙에는 선택적으로 메타데이터를 포함할 수 있습니다.

```ts
id: source("user_id", {
  db: "users.user_id",
  dtoDescription: "Identifier returned by the user API.",
});
```

메타데이터는 매핑 동작에 필수는 아닙니다.

주로 JSDoc 생성이나 문서화 도구에서 사용됩니다.

| 필드               | 용도                                    |
| ---------------- | ------------------------------------- |
| `db`             | 원본 데이터베이스 필드 또는 외부 시스템의 원본 경로를 나타냅니다. |
| `dtoDescription` | DTO 필드에 대한 설명을 제공합니다.                 |

도메인 필드의 일반적인 의미는 도메인 타입의 JSDoc에 작성하는 것이 좋습니다.

```ts
interface User {
  /** User id */
  id: string;
}
```

반면 매퍼 메타데이터에는 DTO나 데이터베이스처럼 특정 소스에 종속된 정보를 넣는 것이 좋습니다.

```ts
id: source("user_id", {
  db: "users.user_id",
  dtoDescription: "Identifier returned by the user API.",
});
```

이렇게 나누면 도메인 모델의 의미와 외부 데이터 출처 정보를 분리해서 관리할 수 있습니다.

<br/>

## 타입 안전 헬퍼

헬퍼 콜백에서 DTO를 타입에 맞게 다뤄야 한다면 `mapperHelpers<TDto>()`를 사용할 수 있습니다.

```ts
import { mapperHelpers } from "runtypex/mapper";

const h = mapperHelpers<UserDto>();

const userMap = defineMap<UserDto, User>()({
  id: h.source("user_id"),
  displayName: h.source("profile.name"),
  isActive: h.transform("status", (value, dto) => {
    return dto.status === "ACTIVE";
  }),
});
```

`mapperHelpers<TDto>()`를 사용하면 `source()`와 `transform()`을 DTO 타입에 맞게 사용할 수 있습니다.

특히 `transform()` 콜백의 두 번째 인자인 `dto`를 사용할 때 유용합니다.

```ts
isActive: h.transform("status", (value, dto) => {
  return dto.status === "ACTIVE";
});
```

위 코드에서 `dto`는 `UserDto`로 타입이 지정되므로, 콜백 안에서도 DTO 필드를 타입 안전하게 참조할 수 있습니다.
