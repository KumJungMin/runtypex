
# 빌드 연동

`runtypex`는 TypeScript 컴파일러 API를 사용해 타입 정보를 분석하고, 이를 바탕으로 검증 함수와 매퍼 코드를 생성합니다.

가장 좋은 사용 방식은 **빌드 과정에서 TypeScript 트랜스포머를 실행하는 것**입니다. 이렇게 하면 타입 정보를 온전히 활용할 수 있어 `runtypex`의 기능을 제대로 사용할 수 있습니다.

<br/>

## Vite에서 사용하기

Vite 프로젝트에서는 `runtypex`의 Vite 플러그인을 등록하면 됩니다.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vitePlugin as runtypex } from "runtypex";

export default defineConfig({
  plugins: [runtypex()],
});
```

Vite 플러그인은 TypeScript 파일을 분석하면서 다음 호출을 찾습니다.

* `makeValidate<T>()`
* `makeAssert<T>()`
* `makeMapper<TDto, TDomain>()`

대상 호출을 찾으면 플러그인은 다음 순서로 동작합니다.

1. 해당 파일에서 가장 가까운 `tsconfig.json`을 찾습니다.
2. TypeScript 프로그램을 생성합니다.
3. `runtypex` 트랜스포머를 실행합니다.
4. 변환된 코드를 Vite에 반환합니다.

즉, 개발자는 위 함수들을 선언적으로 작성하고, 실제 검증 및 매핑 코드는 빌드 과정에서 자동으로 생성됩니다.

<br/>

## Vite에서 매퍼 문서 생성하기

Vite 플러그인은 매퍼 파일을 분석해, 컨벤션 기반으로 타입 문서 파일을 생성할 수도 있습니다.

```ts
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

위 설정을 추가하면 `runtypex`는 지정된 매퍼 파일을 스캔합니다.

예를 들어 다음과 같은 매퍼 선언이 있다고 가정합니다.

```ts
export const addressMap = defineMap<
  SearchAddressDto,
  SearchAddressDomainSource
>()({
  id: source("RESULT.ID"),
});
```

`runtypex`는 두 번째 타입 인자인 `SearchAddressDomainSource`를 기준으로 생성할 도메인 타입 이름을 결정합니다.

기본 설정에서는 `Source` 접미사를 제거하므로, 생성되는 인터페이스 이름은 다음과 같습니다.

```ts
SearchAddressDomain
```

기본 설정에서는 생성된 인터페이스들이 각 매퍼 파일과 같은 폴더의
`runtypex.generated.ts` 파일에 합쳐져 기록됩니다.

> `makeValidate<T>()`, `makeAssert<T>()`, `makeMapper<TDto, TDomain>()`은 빌드 중 코드를 변환하지만,
> `docs` 옵션은 실제 파일인 `runtypex.generated.ts`를 생성합니다.

`docs` 옵션을 설정하지 않으면 `runtypex.generated.ts` 파일은 생성되지 않습니다.

<br/>

## 문서 생성 파일명 설정

기본 생성 파일명은 `runtypex.generated.ts`입니다.

```ts
runtypex({
  docs: {
    include: "src/features/**/*.mapper.ts",
  },
});
```

같은 폴더의 매퍼 결과를 고정된 커스텀 파일명으로 합치고 싶다면
`generatedFileName`에 문자열을 전달합니다.

```ts
runtypex({
  docs: {
    include: "src/features/**/*.mapper.ts",
    generatedFileName: "domain.generated.ts",
  },
});
```

원본 매퍼 파일명을 기준으로 매퍼마다 별도 generated 파일을 만들 수도 있습니다.

```ts
runtypex({
  docs: {
    include: "src/features/**/*.mapper.ts",
    generatedFileName: ({ sourceFileBaseName }) =>
      sourceFileBaseName.replace(/\.mapper\.ts$/, ".generated.ts"),
  },
});
```

예를 들어 `src/features/addressSearch/addressSearch.mapper.ts`는
`src/features/addressSearch/addressSearch.generated.ts`를 생성합니다.

<br/>

## 문서 생성 옵션

| 옵션                  | 기본값                                 | 설명                                                          |
| ------------------- | ----------------------------------- | ----------------------------------------------------------- |
| `include`           | `**/*.mapper.ts`, `**/*.mapper.tsx` | Vite 루트 기준으로 스캔할 매퍼 파일 패턴입니다.                               |
| `exclude`           | generated file name, 또는 함수형 `generatedFileName` 사용 시 `**/*.generated.ts` | 스캔에서 제외할 파일 패턴입니다.                                          |
| `sourceSuffix`      | `Source`                            | 생성 인터페이스 이름을 만들 때 제거할 도메인 타입 접미사입니다.                        |
| `generatedFileName` | `runtypex.generated.ts`             | 각 매퍼 파일 옆에 생성할 파일 이름 또는 파일명 resolver입니다.                       |
| `outDir`            | `near-source`                       | 생성 파일 위치입니다. 현재는 소스 파일 근처 생성만 지원합니다.                        |
| `policyMode`        | `warn`                              | 매퍼가 문서 생성 컨벤션을 어겼을 때의 처리 방식입니다. `error`로 설정하면 빌드 실패로 처리합니다. |

<br/>

## ts-loader에서 사용하기

webpack에서 `ts-loader`를 사용하는 경우, `getCustomTransformers` 옵션에 `runtypex` 트랜스포머를 등록합니다.

```js
// webpack.config.js
const { tsTransformer } = require("runtypex");

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          getCustomTransformers: (program) => ({
            before: [tsTransformer({ program })],
          }),
        },
      },
    ],
  },
};
```

이 설정은 TypeScript 컴파일 전에 `runtypex` 트랜스포머를 실행합니다.

<br/>

## 트랜스포머 옵션

`tsTransformer`에는 다음 옵션을 전달할 수 있습니다.

```ts
tsTransformer({
  program,
  removeInProd: true,
  validateDto: true,
  validateDomain: true,
});
```

| 옵션               | 기본값      | 설명                                           |
| ---------------- | -------- | -------------------------------------------- |
| `program`        | required | 타입 해석에 사용할 TypeScript 프로그램입니다. 반드시 전달해야 합니다. |
| `removeInProd`   | `false`  | 프로덕션 빌드에서 생성된 검증 코드를 no-op 함수로 대체합니다.        |
| `validateDto`    | `true`   | 생성 매퍼에서 DTO 입력값 검증을 활성화합니다.                  |
| `validateDomain` | `true`   | 생성 매퍼에서 도메인 출력값 검증을 활성화합니다.                  |

<br/>

## 패키지 진입점

필요한 기능에 따라 다음 경로에서 가져올 수 있습니다.

```ts
import { makeValidate } from "runtypex";
import { makeMapper } from "runtypex/mapper";
import { generateJSDocFromSpec } from "runtypex/generator";
import { tsTransformer } from "runtypex/transformer";
import { vitePlugin } from "runtypex/transformer/vite-plugin";
```

패키지는 ESM과 CommonJS 빌드를 모두 제공합니다.

* ESM: `dist/esm`
* CommonJS: `dist/cjs`

<br/>

## 로컬 검증

빌드와 테스트가 정상적으로 동작하는지 확인하려면 다음 명령을 사용할 수 있습니다.

```bash
npm run build
npx jest --runInBand --watchman=false
npm run test:esm
```

각 명령의 용도는 다음과 같습니다.

| 명령                                      | 용도                            |
| --------------------------------------- | ----------------------------- |
| `npm run build`                         | 패키지를 빌드합니다.                   |
| `npx jest --runInBand --watchman=false` | Jest 테스트를 단일 프로세스로 실행합니다.     |
| `npm run test:esm`                      | ESM 환경에서 패키지가 정상 동작하는지 확인합니다. |
