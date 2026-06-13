
# 런타임 검증

`runtypex`의 런타임 검증은 TypeScript 타입을 기반으로 런타임 가드 함수를 생성하는 기능입니다.

TypeScript 타입은 일반적으로 컴파일 후 JavaScript 런타임에 남지 않습니다. `runtypex`는 빌드 중 TypeScript 타입 체커를 사용해 타입 정보를 읽고, 이를 일반 JavaScript 검증 코드로 변환합니다.

즉, 다음과 같은 타입을:

```ts
interface User {
  id: number;
  name: string;
}
```

런타임에서 사용할 수 있는 검증 함수로 바꿀 수 있습니다.

```ts
const isUser = (value) =>
  typeof value === "object" &&
  value !== null &&
  typeof value.id === "number" &&
  typeof value.name === "string";
```

<br/>

## API

`runtypex`는 런타임 검증을 위해 두 가지 API를 제공합니다.

```ts
import { makeAssert, makeValidate } from "runtypex";
```

| API                 | 반환값          | 용도                             |
| ------------------- | ------------ | ------------------------------ |
| `makeValidate<T>()` | 판별 함수        | 값이 타입 `T`인지 `boolean`으로 확인합니다. |
| `makeAssert<T>()`   | assertion 함수 | 값이 타입 `T`가 아니면 예외를 던집니다.       |

<br/>

## `makeValidate<T>()`

`makeValidate<T>()`는 타입 판별 함수를 반환합니다.

```ts
const isUser = makeValidate<User>();

if (isUser(input)) {
  input.id;
}
```

`isUser(input)`이 `true`를 반환하면 TypeScript는 `input`을 `User` 타입으로 좁혀서 다룰 수 있습니다.

예를 들어 다음 타입이 있다고 가정합니다.

```ts
interface User {
  id: number;
  name: string;
}
```

다음 코드는:

```ts
const isUser = makeValidate<User>();
```

트랜스포머가 활성화된 빌드에서는 대략 다음과 같은 함수로 변환됩니다.

```ts
const isUser = (input) =>
  typeof input === "object" &&
  input !== null &&
  typeof input.id === "number" &&
  typeof input.name === "string";
```

생성된 코드는 런타임 리플렉션에 의존하지 않습니다. 일반 JavaScript 조건문으로 동작합니다.

<br/>

## `makeAssert<T>()`

`makeAssert<T>()`는 assertion 함수를 반환합니다.

```ts
const assertUser = makeAssert<User>();

assertUser(input);
input.id;
```

`assertUser(input)`이 정상적으로 통과하면, 이후 코드에서 `input`을 `User` 타입으로 다룰 수 있습니다.

값이 `User` 타입에 맞지 않으면 `TypeError`를 던집니다.

```ts
const assertUser = makeAssert<User>();

assertUser(input); // 실패하면 TypeError
```

트랜스포머가 활성화된 경우 다음과 같은 형태의 코드로 변환됩니다.

```ts
const assertUser = (function () {
  const G = (input) =>
    typeof input === "object" &&
    input !== null &&
    typeof input.id === "number" &&
    typeof input.name === "string";

  return (input) => {
    if (!G(input)) {
      throw new TypeError("[runtypex] Validation failed.");
    }
  };
})();
```

<br/>

## 동작 방식

다음과 같이 작성하면:

```ts
interface User {
  id: number;
  name: string;
}

const isUser = makeValidate<User>();
```

`runtypex` 트랜스포머는 빌드 중 TypeScript 타입 체커를 통해 `User` 타입을 읽습니다.

그런 다음 `makeValidate<User>()` 호출을 생성된 JavaScript 검증 함수로 대체합니다.

```js
const isUser = (v) =>
  typeof v === "object" &&
  v !== null &&
  typeof v.id === "number" &&
  typeof v.name === "string";
```

이 과정에서 별도의 스키마 파일이나 런타임 타입 메타데이터는 필요하지 않습니다.

생성된 검증 함수는 `makeValidate<User>()` 호출이 있던 파일 안에 인라인됩니다.

<br/>

## 빌드 시점 변환과 런타임 폴백

`makeValidate<T>()`와 `makeAssert<T>()`는 트랜스포머가 실행될 때 가장 의미가 있습니다.

TypeScript 타입 `T`는 JavaScript 런타임에 존재하지 않습니다. 따라서 트랜스포머 없이 순수 런타임만으로는 `T`의 구조를 알 수 없습니다.

<br/>

## 트랜스포머가 활성화된 경우

Vite 플러그인이나 TypeScript 트랜스포머가 활성화되어 있으면 다음 호출은:

```ts
const isUser = makeValidate<User>();
```

변환된 소스 파일 안에서 실제 검증 함수로 대체됩니다.

```ts
const isUser = (input) =>
  typeof input === "object" &&
  input !== null &&
  typeof input.id === "number" &&
  typeof input.name === "string";
```

이때 별도의 스키마 파일은 생성되지 않습니다.

검증 함수는 기존 소스 파일 안에 인라인됩니다.

<br/>

## 트랜스포머가 없는 경우

트랜스포머가 실행되지 않으면 패키지의 런타임 폴백이 사용됩니다.

```ts
function __validate<T>(_value: unknown): boolean {
  return true;
}

export function makeValidate<T>() {
  return (value: unknown): value is T => __validate<T>(value);
}
```

이 폴백은 의도적으로 자리표시자 역할만 합니다.

중요한 점은, 이 경우 `T`의 구조를 실제로 검증하지 않는다는 것입니다.

```ts
const isUser = makeValidate<User>();

isUser({}); // 트랜스포머가 없으면 실제 구조 검증을 하지 않습니다.
```

따라서 실제 런타임 검증이 필요하다면 반드시 Vite 플러그인 또는 TypeScript 트랜스포머를 빌드에 연동해야 합니다.

<br/>

## `makeAssert<T>()`의 폴백 동작

트랜스포머가 없으면 `makeAssert<T>()`는 내부적으로 `makeValidate<T>()`를 사용합니다.

```ts
const assertUser = makeAssert<User>();
```

하지만 트랜스포머가 없는 환경에서는 `makeValidate<T>()` 역시 실제 타입 구조를 검사하지 않습니다.

따라서 `makeAssert<T>()`도 같은 자리표시자 폴백을 사용하며, `T`를 실제로 검증하지 않습니다.

정리하면 다음과 같습니다.

| 환경       | `makeValidate<T>()` | `makeAssert<T>()`         |
| -------- | ------------------- | ------------------------- |
| 트랜스포머 있음 | 실제 타입 검증 함수로 변환됩니다. | 실제 타입 검증 후 실패 시 예외를 던집니다. |
| 트랜스포머 없음 | 자리표시자 폴백을 사용합니다.    | 같은 자리표시자 폴백을 사용합니다.       |

<br/>

## 프로덕션에서 검증 제거하기

트랜스포머 옵션에서 `removeInProd: true`를 활성화하고, `NODE_ENV`가 `production`이면 생성된 검증기는 no-op에 해당하는 함수로 대체됩니다.

```ts
makeValidate<T>(); // (_) => true
makeAssert<T>();   // (_) => {}
```

즉, 프로덕션 빌드에서는 검증 비용을 제거할 수 있습니다.

이 옵션은 런타임 검증을 **프로덕션 경계의 보안 장치**가 아니라 **개발 중 안전장치**로 사용할 때 적합합니다.

예를 들어 개발 환경에서는 DTO 구조가 예상과 다른지 빠르게 확인하고, 프로덕션에서는 검증 비용을 줄이고 싶을 때 사용할 수 있습니다.

반대로 외부 입력을 프로덕션에서도 반드시 검증해야 한다면 `removeInProd: true`를 사용하지 않는 것이 좋습니다.

<br/>

## 지원하는 타입 형태

현재 emitter는 일반적으로 사용하는 TypeScript 타입 형태를 지원합니다.

| 타입 형태                       | 예시                                                |             |
| --------------------------- | ------------------------------------------------- | ----------- |
| primitive                   | `string`, `number`, `boolean`                     |             |
| object / interface property | `{ id: string }`, `interface User { id: string }` |             |
| optional property           | `{ name?: string }`                               |             |
| array                       | `string[]`, `Array<User>`                         |             |
| tuple                       | `[string, number]`                                |             |
| union                       | `"ACTIVE"                                         | "INACTIVE"` |
| intersection                | `A & B`                                           |             |
| literal type                | `"admin"`, `1`, `true`                            |             |
| enum                        | `enum Status { Active }`                          |             |

엣지 케이스별 정확한 동작은 emitter 테스트를 기준으로 확인하는 것이 좋습니다.

<br/>

## 요약

`runtypex`의 런타임 검증은 TypeScript 타입을 빌드 시점에 JavaScript 검증 함수로 변환합니다.

| 항목                   | 설명                                       |
| -------------------- | ---------------------------------------- |
| `makeValidate<T>()`  | 값이 `T`인지 확인하는 판별 함수를 생성합니다.              |
| `makeAssert<T>()`    | 값이 `T`가 아니면 예외를 던지는 assertion 함수를 생성합니다. |
| 트랜스포머 있음             | TypeScript 타입을 기반으로 실제 검증 코드가 인라인됩니다.    |
| 트랜스포머 없음             | 타입 정보를 알 수 없어 자리표시자 폴백이 사용됩니다.           |
| `removeInProd: true` | 프로덕션에서 검증 함수를 no-op으로 대체합니다.             |
| 생성 방식                | 별도 스키마 파일 없이 기존 소스 파일 안에 검증 함수가 인라인됩니다.  |

실제 타입 검증을 사용하려면 `makeValidate<T>()` 또는 `makeAssert<T>()`만 호출하는 것으로는 충분하지 않습니다. 반드시 Vite 플러그인이나 TypeScript 트랜스포머를 빌드에 연동해야 합니다.
