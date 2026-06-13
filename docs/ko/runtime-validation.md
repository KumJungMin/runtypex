# 런타임 검증

런타임 검증은 `runtypex`의 핵심 기능입니다. 빌드 중 TypeScript 타입을 런타임
가드 함수로 변환합니다.


<br/>

## API

```ts
import { makeAssert, makeValidate } from "runtypex";
```

`makeValidate<T>()`는 판별 함수를 반환합니다.

```ts
const isUser = makeValidate<User>();

if (isUser(input)) {
  input.id;
}
```


<br/>

`makeAssert<T>()`는 assertion 함수를 반환합니다.

```ts
const assertUser = makeAssert<User>();

assertUser(input);
input.id;
```


<br/>

## 동작 방식

다음과 같이 작성하면

```ts
interface User {
  id: number;
  name: string;
}

const isUser = makeValidate<User>();
```


<br/>

트랜스포머는 TypeScript 타입 체커를 통해 `User` 타입을 읽고, 해당 호출을
생성된 JavaScript로 대체합니다.

```js
const isUser = (v) =>
  typeof v === "object" &&
  v !== null &&
  typeof v.id === "number" &&
  typeof v.name === "string";
```

런타임 리플렉션은 필요하지 않습니다. 생성되는 코드는 일반 JavaScript입니다.


<br/>

## 빌드 시점 vs 런타임 폴백

`makeValidate<T>()`와 `makeAssert<T>()`는 트랜스포머가 실행될 때 빌드 시점
마커로 의미가 있습니다. TypeScript 타입 `T`는 런타임에 지워지기 때문에, 순수
런타임 폴백은 해당 타입을 검사할 수 없습니다.

### `makeValidate<T>()`

다음과 같이 작성하면

```ts
const isUser = makeValidate<User>();
```

Vite 플러그인 또는 TypeScript 트랜스포머가 활성화된 경우, 이 호출은 변환된
소스 파일 안에서 생성된 판별 함수로 대체됩니다.

```ts
const isUser = (input) =>
  typeof input === "object" &&
  input !== null &&
  typeof input.id === "number" &&
  typeof input.name === "string";
```

별도의 스키마 파일은 생성되지 않습니다. 생성된 함수는 `makeValidate<User>()`가
있던 파일 안에 인라인됩니다.

트랜스포머가 없으면 패키지의 런타임 폴백이 사용됩니다.

```ts
function __validate<T>(_value: unknown): boolean {
  return true;
}

export function makeValidate<T>() {
  return (value: unknown): value is T => __validate<T>(value);
}
```

이 폴백은 의도적으로 자리표시자 역할만 합니다. `T`의 구조를 실제로
검증하지 않습니다.


<br/>

### `makeAssert<T>()`

다음과 같이 작성하면

```ts
const assertUser = makeAssert<User>();
```

트랜스포머가 활성화된 경우, 이 호출은 생성된 판별 함수를 클로저로 참조하는
assertion 함수로 대체됩니다.

```ts
const assertUser = (function () {
  const G = (input) =>
    typeof input === "object" &&
    input !== null &&
    typeof input.id === "number" &&
    typeof input.name === "string";

  return (input) => {
    if (!G(input)) throw new TypeError("[runtypex] Validation failed.");
  };
})();
```

트랜스포머가 없으면 `makeAssert<T>()`는 `makeValidate<T>()`를 호출합니다.
따라서 같은 자리표시자 폴백을 사용하며 `T`를 실제로 검증하지 않습니다.


<br/>

## 프로덕션 제거

`removeInProd: true`를 활성화하고 `NODE_ENV`가 `production`이면 검증기는
no-op에 해당하는 함수로 대체됩니다.

```ts
makeValidate<T>(); // (_) => true
makeAssert<T>(); // (_) => {}
```

런타임 검증을 프로덕션 경계가 아니라 개발 중 안전장치로 사용할 때만 이 옵션을
사용하세요.


<br/>

## 지원하는 타입 형태 예시

현재 emitter는 일반적으로 사용하는 TypeScript 타입 형태를 지원합니다.

- primitive
- object 및 interface property
- optional property
- array
- tuple
- union
- intersection
- literal type
- enum

엣지 케이스별 정확한 동작은 emitter 테스트를 참고하세요.
