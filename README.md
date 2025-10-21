# 🛡️ runtypex

TypeScript 타입으로부터 **런타임 타입 가드(runtime type guard)** 를 자동 생성합니다.  
스키마도, 데코레이터도 필요 없습니다.  
**빌드 시 타입 정보를 분석해 최적화된 검증 함수를 자동 생성하며**,  
타입만으로 → **런타임 검증**을 수행합니다.

> Generate **runtime type guards** automatically from your TypeScript types.  
> No schemas. No decorators.  
> **Analyzes types at build time to generate optimized validation functions**,  
> enabling **blazing-fast runtime validation** powered purely by TypeScript.


<br/><br/>

## ⚙️ 사용법 (Usage)
```bash
npm i runtypex
```

```ts
import { makeValidate, makeAssert } from "runtypex";

interface User {
  id: number;
  name: string;
  active: boolean;
}

const isUser = makeValidate<User>();
const assertUser: ReturnType<typeof makeAssert<User>> = makeAssert<User>();

isUser({ id: 1, name: "Lux", active: true });  // ✅ true
assertUser({ id: "bad" });                      // ❌ throws
```

<br/><br/>

### Vite 예시 (Vite Example)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vitePlugin as runtypex } from "runtypex";

export default defineConfig({
  plugins: [runtypex()],
});
```

<br/>

프로덕션 빌드 시 런타임 검증 코드를 제거하려면 옵션 `{ removeInProd: true }`를 전달하세요.  
To remove validation code in production builds, pass `{ removeInProd: true }`.

```ts
export default defineConfig({
  plugins: [runtypex({ removeInProd: true })],
});
```

<br/>

### Webpack (ts-loader) 예시 (Webpack Example)

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
            before: [ tsTransformer({ program }) ]
          })
        }
      }
    ]
  }
}
```

<br/><br/>

## ⚡ runtypex의 특징 (Features)

| 항목 | 설명 | Description |
|------|------|-------------|
| ⚡ **빠름 (Fast)** | AST로 컴파일된 검증 코드, 런타임 스키마 파싱 없음 | Compiled guards, no runtime schema parsing |
| 🧩 **단순함 (Simple)** | 타입만 정의, 스키마 중복 선언 불필요 | Define once, no schema duplication |
| 🧱 **유연함 (Flexible)** | Vite, Webpack 모두 지원 | Works with both Vite and Webpack |
| 🛠️ **API** | `makeValidate`, `makeAssert` 제공 | Clean runtime API |

<br/><br/>

## 🧪 데모 (Demo)

🔗 [runtypex-demo (GitHub)](https://github.com/KumJungMin/runtypex-demo)  
TypeScript 타입이 **빌드 시 자동으로 런타임 검증 코드로 변환되는 과정**을 확인할 수 있습니다.  
See how TypeScript types are transformed into real runtime guards at build time.

<br/><br/>

## 🧭 만들게 된 이유 (Background)

TypeScript의 타입 시스템 덕분에 코드 상에서는 안전했지만,  
결정적인 한계를 마주했습니다.

> TypeScript의 타입은 **런타임에 존재하지 않는다.**  
> TypeScript types **do not exist at runtime.**

<br/>


즉, 빌드 타임에는 안전하지만 실제 실행 환경(JS)에서는  
모든 타입 정보가 사라집니다.  
결국 **API나 외부 모듈에서 잘못된 타입의 데이터가 들어와도 검증할 방법이 없었습니다.**

> In short, TypeScript ensures type safety at build time,  
> but once the code is compiled, all type information disappears.  
> This means that even if invalid data comes from an API or an external source,  
> there’s no way to detect it at runtime.

<br/>

### 💡 기존의 시도 (Existing Approach): Zod 등 스키마 기반 검증 <br/>(Previous Approach: Schema-Based Validators (e.g., Zod, Yup))

Zod, Yup 같은 **스키마 기반 검증기**를 먼저 시도했습니다.  
하지만 다음 세 가지 문제에 부딪혔습니다:  

> We first tried schema-based validators like **Zod** and **Yup**,  
> but encountered three main problems:

| 문제 | 설명 | Problem | Description |
|------|------|----------|-------------|
| ⚡ 성능 | 매번 스키마를 해석하며 검증 → 반복 비용 발생 | Performance | Every validation re-parses schema, causing overhead |
| ⚠️ 안정성 | 타입 정의와 스키마 불일치 가능 | Safety | Schema can desync from TypeScript type definitions |
| 🧑‍💻 DX | 타입이 중복 선언됨 (`interface` + `z.object`) | DX | Requires writing both `interface` and `z.object` |

---

### 🧠 새로운 접근 (New Approach): AST로 검증 코드 생성<br/>(A New Approach: Compile-Time Guard Generation via AST)

runtypex는 **TypeScript AST(Abstract Syntax Tree)** 를 분석해  
**빌드 시점에 자동으로 검증 함수를 생성합니다.**

> runtypex analyzes the **TypeScript AST (Abstract Syntax Tree)**  
> and automatically generates runtime validation functions **at build time**.

이 방식은 다음과 같은 장점을 가집니다 👇  
This approach provides several key advantages 👇

- 타입 정의 한 번으로 런타임 검증 자동화  
  → **Single source of truth** for type + validation  
- 타입 불일치 문제 제거  
  → Eliminates schema desync between TS and runtime  
- 런타임 오버헤드 최소화  
  → No dynamic schema parsing during execution  

<br/><br/>

## 📘 개념 요약 (Concept Overview)

| 항목 | 내용 | Concept | Description |
|------|------|----------|-------------|
| **문제** | TypeScript 타입은 런타임에서 사라진다 | Problem | TypeScript types vanish at runtime |
| **결과** | 외부 데이터 불일치 시 에러 발생 안 함 | Result | Type mismatches aren’t caught at runtime |
| **해결** | AST로 타입 분석 → 검증 코드 자동 생성 | Solution | Parse TS AST → Generate guard functions |

> Simply put: runtypex bridges the gap between TypeScript’s compile-time safety  
> and JavaScript’s runtime uncertainty — automatically.

<br/>

### 🧩 예시 (Example)

```ts
// Before: manual type guard
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as any).id === "number" &&
    typeof (value as any).name === "string"
  );
}

// After: runtypex auto-generated
const isUser = makeValidate<User>();
```

<br/>

빌드 시 `makeValidate<User>()`는  
AST를 기반으로 아래와 같은 함수로 **자동 변환됩니다.**

> At build time, `makeValidate<User>()`  
> is replaced with the following optimized validation code:

```js
const isUser = (v) =>
  typeof v === "object" &&
  v !== null &&
  typeof v.id === "number" &&
  typeof v.name === "string";
```

> ✅ Zero runtime parsing  
> ✅ Fully type-synced  
> ✅ Generated during build — not executed dynamically  

<br/>

### 📚 더 읽어보기 (Further Reading)

📖 [TS × 클린 아키텍처 2편 — 타입스크립트 한계와 Mapper, AST로 타입 검증하기](https://mong-blog.tistory.com/entry/TS-×-클린-아키텍처-2편-—-타입스크립트-한계와-Mapper-AST로-타입-검증하기)  
> AST 기반 타입 검증 자동화의 원리와 빌드 타임 최적화 과정을 자세히 다룹니다.  
> A deep dive into how AST-based type parsing enables build-time validation generation and optimization.

<br/>

### ✅ 요약 (Summary)

| 핵심 포인트 | English Summary |
|--------------|-----------------|
| TypeScript 타입은 런타임에 존재하지 않는다 | TypeScript types vanish at runtime |
| 외부 API로부터의 데이터는 신뢰할 수 없다 | External data can’t be trusted blindly |
| AST로 타입을 분석해 검증 함수를 생성한다 | Parse TS AST → generate guards at build time |
| 런타임 오버헤드 없이 타입 안전성을 확보한다 | Provides runtime safety with zero runtime cost |
| DX, 안정성, 성능 모두 강화된다 | Improves DX, safety, and performance |


<br/><br/>

## 🆕 v0.2.0 업데이트 예정 (Upcoming in v0.2.0)

### 🚀 새로운 기능 (New Features)

| 항목 | 설명 | Description |
|------|------|-------------|
| ⚙️ **mode 옵션 추가** | 런타임 동작 모드 설정 (`"development"`, `"production"`, `"test"`) | Define runtime behavior mode (`"development"`, `"production"`, `"test"`) |
| 🧹 **strip 옵션 추가** | 빌드 시 모든 `makeAssert`, `makeValidate` 호출을 제거하여 파일 크기 최소화 | Removes all runtime validators from build output for minimal bundle size |
| 🪶 **logLevel 옵션 추가** | 플러그인 로깅 레벨 설정 (`"silent"`, `"info"`, `"debug"`) | Controls plugin log verbosity (`"silent"`, `"info"`, `"debug"`) |
| 🏷️ **`/* @runtypex:keep */` 주석 지원** | 특정 검증 함수는 제거하지 않고 유지 (`strip` 활성화 시 예외 처리용) | Preserve marked validators even when `strip` is enabled |

<br/>

### ⚙️ 예시 (Example)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { vitePlugin as runtypex } from "runtypex";

export default defineConfig({
  plugins: [
    runtypex({
      mode: "development",   // 런타임 검증 유지
      strip: false,          // 검증 코드 제거 비활성화
      logLevel: "info",      // 일반 로그 출력
    }),
  ],
});
```


```ts
/* @runtypex:keep */
const assertUser = makeAssert<User>();
```

> `/* @runtypex:keep */` 주석을 붙이면 `strip` 옵션이 활성화되어도  
> 해당 검증 함수는 빌드 결과물에서 제거되지 않습니다.  
> Add `/* @runtypex:keep */` above a validator to keep it even when `strip` is enabled.
