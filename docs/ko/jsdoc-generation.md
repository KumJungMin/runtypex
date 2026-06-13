

# JSDoc 생성

`runtypex`는 매퍼 메타데이터를 바탕으로 도메인 인터페이스용 JSDoc 문서를 생성할 수 있습니다.

생성된 JSDoc은 에디터에서 도메인 필드를 볼 때 다음 정보를 함께 확인할 수 있도록 돕습니다.

* 도메인 필드의 설명
* 해당 필드가 참조하는 DTO 경로
* DTO 필드 설명
* DTO 타입
* 원본 데이터 출처
* 도메인 타입

즉, 매퍼를 통해 만들어진 도메인 필드가 **어떤 DTO 또는 원본 필드에서 왔는지**를 코드 안에서 바로 확인할 수 있습니다.


<br/>

## Vite에서 자동 생성하기

Vite 프로젝트에서는 `runtypex` 플러그인의 `docs` 옵션을 설정하면 JSDoc 문서 파일을 자동으로 생성할 수 있습니다.

```ts
import { defineConfig } from "vite";
import { vitePlugin as runtypex } from "runtypex";

export default defineConfig({
  plugins: [
    runtypex({
      docs: {
        include: "src/features/**/*.mapper.ts",
      },
    }),
  ],
});
```

플러그인은 `docs.include`에 포함된 매퍼 파일을 스캔하고, 다음 형태의 호출을 찾습니다.

```ts
defineMap<TDto, TDomainSource>()(...)
```

그런 다음 두 번째 타입 인자인 `TDomainSource`를 기준으로 생성할 인터페이스 이름을 결정합니다.

기본 설정에서는 `Source` 접미사를 제거합니다.

예를 들어 다음 타입은:

```ts
SearchAddressDomainSource
```

다음 인터페이스 이름으로 생성됩니다.

```ts
SearchAddressDomain
```

생성된 인터페이스는 매퍼 파일과 같은 폴더의 `runtypex.generated.ts` 파일에 기록됩니다.


<br/>

## 생성 예시

다음과 같은 매퍼 파일이 있다고 가정합니다.

```ts
// src/features/address/address.mapper.ts
export interface SearchAddressDomainSource {
  /** Address id */
  id: string;
}

export const addressMap = defineMap<
  SearchAddressDto,
  SearchAddressDomainSource
>()({
  id: source("RESULT.ID", {
    db: "address.id",
    dtoDescription: "Address identifier from the API response.",
  }),
});
```

`runtypex`는 매퍼 파일 옆에 다음과 같은 생성 파일을 기록합니다.

```ts
// src/features/address/runtypex.generated.ts
export interface SearchAddressDomain {
  /**
   * Address id
   *
   * - DTO: `SearchAddressDto.RESULT.ID`
   * - DTO description: Address identifier from the API response.
   * - DTO type: `string`
   * - Origin: `address.id`
   * - Domain type: `string`
   */
  id: string;
}
```

이 문서는 런타임 코드가 아니라, 타입과 에디터 경험을 위한 `.ts` 문서 파일입니다.


<br/>

## 문서 생성 시점

JSDoc 문서 생성은 Vite 플러그인의 `buildStart` 훅에서 실행됩니다.

따라서 다음 조건을 만족할 때만 문서 파일이 생성됩니다.

1. Vite 플러그인을 사용합니다.
2. `docs` 옵션을 설정합니다.
3. `docs.include`에 해당하는 매퍼 파일이 있습니다.
4. 해당 파일 안에 `defineMap<TDto, TDomainSource>()(...)` 호출이 있습니다.

반대로 다음 경우에는 `runtypex.generated.ts` 파일이 생성되지 않습니다.

* `docs` 옵션을 설정하지 않은 경우
* Vite 플러그인을 실행하지 않은 경우
* 포함 조건에 맞는 매퍼 파일이 없는 경우
* 매퍼 파일이 문서 생성 컨벤션을 따르지 않는 경우

문서 생성은 애플리케이션 런타임 코드를 변경하지 않습니다. 매퍼 파일도 그대로 유지되며, 출력 결과는 생성된 `.ts` 문서 파일뿐입니다.


<br/>

## 수동 API 사용하기

Vite 플러그인을 사용하지 않고, 자체 빌드 도구에서 JSDoc 생성을 직접 실행할 수도 있습니다.

```ts
import { generateJSDocFromSpec } from "runtypex/generator";

const source = generateJSDocFromSpec({
  checker,
  dtoType,
  domainType,
  specNode,
});
```

`generateJSDocFromSpec()`은 저수준 API입니다.

이 API는 다음 값에 이미 접근할 수 있는 빌드 도구를 위한 기능입니다.

* TypeScript 프로그램
* TypeScript checker
* DTO 타입
* 도메인 타입
* 매퍼 명세 노드

일반적인 Vite 프로젝트에서는 직접 호출하기보다 `docs` 옵션을 사용하는 것을 권장합니다.


<br/>

## 메타데이터 작성 위치

도메인 필드의 기본 설명은 도메인 타입에 작성하는 것이 좋습니다.

```ts
interface User {
  /** User id */
  id: string;
}
```

매퍼 메타데이터에는 DTO 또는 원본 데이터에 특화된 설명을 작성할 수 있습니다.

```ts
source("user_id", {
  db: "users.user_id",
  dtoDescription: "Identifier returned by the user API.",
});
```

각 필드는 생성된 JSDoc에서 다음과 같이 사용됩니다.

| 필드                    | 설명                                       |
| --------------------- | ---------------------------------------- |
| Domain property JSDoc | 도메인 필드 설명입니다. 일반적으로 JSDoc의 첫 문장으로 사용됩니다. |
| `dtoDescription`      | `DTO description` 항목에 표시되는 선택 설명입니다.     |
| `db`                  | `Origin` 항목에 표시되는 선택 원본 필드입니다.           |


<br/>

## `description` 폴백

이전 매퍼 명세와의 호환성을 위해, 도메인 프로퍼티에 JSDoc이 없으면 매퍼 메타데이터의 `description` 값을 폴백으로 사용합니다.

다만 새 코드에서는 도메인 프로퍼티 JSDoc을 우선 사용하는 것이 좋습니다.

```ts
interface User {
  /** User id */
  id: string;
}
```

이 방식은 도메인 필드의 의미를 타입 정의에 한 번만 작성할 수 있게 해줍니다. 같은 도메인 필드를 여러 DTO 매핑에서 사용할 때도 설명을 반복하지 않아도 됩니다.


<br/>

## 생성 결과 예시

다음 도메인 타입과 매핑이 있다고 가정합니다.

```ts
interface User {
  /** User id */
  id: string;
}
```

```ts
id: source("user_id", {
  db: "users.user_id",
  dtoDescription: "Identifier returned by the user API.",
});
```

생성되는 JSDoc은 다음과 같은 형태가 됩니다.

```ts
/**
 * User id
 *
 * - DTO: `UserDto.user_id`
 * - DTO description: Identifier returned by the user API.
 * - DTO type: `string`
 * - Origin: `users.user_id`
 * - Domain type: `string`
 */
id: string;
```


<br/>

## 정책 옵션 연동

JSDoc 생성은 매퍼 정책 옵션과 함께 사용할 수 있습니다.

정책 옵션을 설정하면 매퍼 명세가 표준 DTO 경로 명명 규칙을 위반했을 때 경고를 출력하거나, 문서 생성 자체를 실패시킬 수 있습니다.

```ts
generateJSDocFromSpec({
  checker,
  dtoType,
  domainType,
  specNode,
  options: {
    mappingPolicy: policy,
    policyMode: "error",
  },
});
```

`policyMode`는 정책 위반을 어떻게 처리할지 결정합니다.

| 값       | 동작                             |
| ------- | ------------------------------ |
| `warn`  | 정책 위반을 경고로 처리합니다.              |
| `error` | 정책 위반을 오류로 처리하고 문서 생성을 실패시킵니다. |

이 옵션은 생성 문서가 런타임 매퍼 및 빌드 시점 매퍼 생성과 같은 명명 규칙을 따르도록 만들고 싶을 때 유용합니다.
