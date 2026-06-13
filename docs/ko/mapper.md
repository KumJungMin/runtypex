# 매퍼

매퍼 기능은 타입이 지정된 매핑 명세를 사용해 DTO 객체를 도메인 객체로
변환합니다. API나 데이터베이스 필드 이름이 애플리케이션 내부에서 사용하는 이름과
다를 때 유용합니다.

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


<br/>

## 타입 레벨 보장

`defineMap<TDto, TDomain>()`은 컴파일 시점에 매핑 명세를 검사합니다.

- 모든 도메인 필드가 매핑 명세에 있어야 합니다.
- 모든 `source()` 또는 `transform()` 경로는 DTO 타입에 존재해야 합니다.
- transform 콜백은 최종 도메인 필드 값을 반환할 수 있습니다.

덕분에 DTO 변경 사항이 런타임에서 조용히 실패하지 않고 컴파일 시점에 드러납니다.


<br/>

## 런타임 동작

트랜스포머가 없으면 `makeMapper()`는 런타임에 매핑 명세를 해석합니다.

```ts
const user = toUser(dto);
```

각 도메인 키에 대해 매퍼는 다음 순서로 동작합니다.

1. 설정된 경로에서 DTO 값을 읽습니다.
2. 소스 값이 없고 default가 있으면 default를 적용합니다.
3. transform 콜백이 있으면 실행합니다.
4. 결과를 도메인 출력 객체에 기록합니다.

런타임 폴백은 빌드 연동 없이도 매핑 동작을 사용할 수 있게 해줍니다.

```ts
const toUser = makeMapper<UserDto, User>(userMap);

toUser({
  user_id: "u1",
  profile: { name: "Lux" },
  status: "ACTIVE",
});
```

런타임에서 `makeMapper()`는 `userMap` 객체를 순회하고, 입력 DTO에서 각 `from`
경로를 읽은 뒤, 필요한 경우 `default`와 `transform`을 적용해 도메인 객체를
반환합니다. 이 과정에서 새 소스 파일을 만들지 않으며 생성 코드를 인라인하지도
않습니다.


<br/>

## 트랜스포머 동작

트랜스포머를 활성화하면 다음 호출은

```ts
const toUser = makeMapper<UserDto, User>(userMap);
```

인라인 매퍼 함수로 대체됩니다. 생성된 함수는 매핑 전에 DTO 입력을 검증하고,
매핑 후에 도메인 출력을 검증할 수 있습니다.

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
      return typeof rule.transform === "function" ? rule.transform(value, input) : value;
    };

    const output = {
      id: R("id", input["user_id"]),
      displayName: R("displayName", input["profile"]["name"]),
      isActive: R("isActive", input["status"]),
    };

    if (!VO(output)) throw new TypeError("[runtypex] Domain validation failed.");
    return output;
  };
})();
```

트랜스포머는 별도의 매퍼 파일을 만들지 않습니다. 매퍼 함수는
`makeMapper<TDto, TDomain>()`을 포함하던 변환 대상 파일에 인라인됩니다.

`removeInProd: true`를 활성화하고 `NODE_ENV`가 `production`이면 매퍼 자체는
계속 생성되지만 DTO 및 도메인 검증 가드는 제거됩니다.

```ts
const output = {
  id: R("id", input["user_id"]),
  displayName: R("displayName", input["profile"]["name"]),
  isActive: R("isActive", input["status"]),
};

return output;
```

이 방식은 하나의 매핑 선언을 유지하면서도 빌드 시점에 최적화된 런타임 코드를
얻을 수 있게 해줍니다.


<br/>

## 메타데이터

매핑 규칙에는 메타데이터를 포함할 수 있습니다.

```ts
id: source("user_id", {
  db: "users.user_id",
  dtoDescription: "Identifier returned by the user API.",
});
```

메타데이터는 매핑에 필수는 아닙니다. 주로 JSDoc 생성과 문서화 도구에서
사용됩니다. 도메인 필드 설명은 도메인 타입의 JSDoc에 두고, 매퍼 메타데이터에는
DTO 또는 데이터베이스에 특화된 설명을 넣는 것이 좋습니다.


<br/>

## 타입이 지정된 헬퍼

헬퍼 콜백에서 DTO를 타입에 맞게 다뤄야 한다면 `mapperHelpers<TDto>()`를
사용합니다.

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
