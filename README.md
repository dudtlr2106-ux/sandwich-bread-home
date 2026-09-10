# 우리집 — KOCOM + SmartThings Home IoT

Next.js + TypeScript 기반의 아파트 홈 IoT 웹앱 1차 버전입니다.

구조:

```text
우리집 앱 프론트엔드
  → 우리 백엔드/API (Next.js Route Handlers)
  → SmartThings API
  → SmartThings Hub
  → KOCOM Edge Driver
  → RS485-LAN 브리지
  → KOCOM 조명/난방/환기/콘센트
```

SmartThings에 이미 등록된 삼성 가전도 같은 장치 목록에서 함께 표시됩니다.

## 안전 원칙

- `SMARTTHINGS_TOKEN`은 **서버 환경변수에만** 둡니다. `NEXT_PUBLIC_` 접두사를 절대 사용하지 않습니다.
- 브라우저는 오직 `/api/...`만 호출하며 SmartThings 토큰을 직접 보지 않습니다.
- 도어락/문열기는 placeholder입니다. 제어 명령이 구현되어 있지 않습니다.
- KOCOM raw RS485 패킷은 `docs/kocom_protocol.md`에서 `CONFIRMED`가 되기 전에는 구현/송신하지 않습니다.
- `edge-driver/src/kocom_protocol.lua`의 확정 패킷 목록은 현재 비어 있습니다.
- Edge Driver에는 현재 LAN/RS485 송신 transport 자체가 없습니다.

## 포함 기능

- 홈 화면 / 방별 장치 카드
- 조명 ON/OFF
- 난방 현재온도 / 설정온도 / ON/OFF
- 환기 OFF / 약 / 중 / 강
- 콘센트 ON/OFF
- 삼성 세탁기·식기세척기 전용 시작 제어 (Smart Control 상태 확인)
- SmartThings 장치 목록 조회
- SmartThings 장치 상태 조회
- SmartThings 명령 전송 API
- 로그 화면
- mock 모드
- 도어락 비활성 placeholder

## 프로젝트 구조

```text
app/
  api/
    devices/
      route.ts
      [deviceId]/status/route.ts
      [deviceId]/commands/route.ts
    logs/route.ts
  logs/page.tsx
  page.tsx
components/
lib/
smartthings/
adapters/
edge-driver/
docs/
logs/
```

## 개발 실행

Node.js가 설치되어 있다는 전제입니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

기본값은 `IOT_MODE=mock`이므로 SmartThings 토큰 없이도 모든 UI 흐름을 시험할 수 있습니다.

## 환경변수

`.env.local` 예시:

```env
IOT_MODE=mock
SMARTTHINGS_TOKEN=
SMARTTHINGS_BASE_URL=https://api.smartthings.com/v1
SMARTTHINGS_LOCATION_ID=
```

### `IOT_MODE`

- `mock`: 로컬 mock 장치 사용
- `smartthings`: 실제 SmartThings Cloud API 사용

### `SMARTTHINGS_TOKEN`

SmartThings API access token입니다. 이 값은 서버에서만 읽습니다.

**금지:**

```env
NEXT_PUBLIC_SMARTTHINGS_TOKEN=...
```

이렇게 만들면 브라우저 번들에 노출될 수 있으므로 사용하지 않습니다.

## SmartThings 연결 방법

1. SmartThings에서 앱/통합용 access token을 준비합니다.
2. 읽기/제어 대상 장치에 필요한 권한을 부여합니다.
3. `.env.local`에 `SMARTTHINGS_TOKEN`을 설정합니다.
4. 특정 Location만 사용할 경우 `SMARTTHINGS_LOCATION_ID`도 설정합니다.
5. `IOT_MODE=smartthings`로 변경 후 개발 서버를 재시작합니다.
6. `/api/devices`에서 장치 목록이 반환되는지 먼저 확인합니다.
7. 홈 화면에서 room/device/capability가 예상대로 매핑되는지 확인합니다.

이 앱이 사용하는 주요 SmartThings API:

```text
GET  /v1/devices?includeStatus=true&includeHealth=true
GET  /v1/devices/{deviceId}/status
GET  /v1/locations/{locationId}/rooms
POST /v1/devices/{deviceId}/commands
```

## mock → 실제 SmartThings 전환

### 1. mock에서 UI 검증

```env
IOT_MODE=mock
```

조명, 난방, 환기, 콘센트, 삼성 TV 예시, 도어락 placeholder가 표시됩니다.

### 2. SmartThings 토큰 등록

```env
IOT_MODE=smartthings
SMARTTHINGS_TOKEN=YOUR_TOKEN
```

### 3. 실제 capability 확인

`/api/devices` 반환값의 `capabilities.raw`를 확인합니다.

현재 앱에서 안전하게 명령을 매핑한 표준 capability:

- `switch` → `on` / `off`
- `thermostatHeatingSetpoint` → `setHeatingSetpoint(value)`
- `fanSpeed` → `setFanSpeed(0..3)`
- 환기 장치가 `switch`도 노출하면 OFF 시 `switch.off`, 약/중/강 시 `switch.on` + `fanSpeed`를 같이 보냅니다.

도어락 `lock` capability는 **탐지하더라도 command mapper에서 거부**합니다.

### 4. 삼성 가전

삼성 세탁기는 `samsungce.washerOperatingState.start`, 식기세척기는 `samsungce.dishwasherOperation.start`로 매핑합니다. 서버가 해당 구성요소의 capability 버전과 명령 정의를 조회해 인수 없는 시작을 지원하는지 확인합니다. Smart Control이 켜져 있어야 하며, 작동 중이거나 오프라인이면 거부합니다. 일반 switch로 가전을 시작하지 않습니다.

## Edge Driver 연동 지점

웹앱은 KOCOM raw RS485를 직접 다루지 않습니다.

```text
웹앱
→ SmartThings capability command
→ SmartThings Hub
→ edge-driver/
→ 검증된 KOCOM protocol encoder
→ RS485-LAN transport
```

현재 `edge-driver/`는 다음 상태입니다.

- 조명: `switch`
- 난방: `switch`, `temperatureMeasurement`, `thermostatHeatingSetpoint`
- 환기: `switch`, `fanSpeed`
- 콘센트: `switch`
- raw 패킷 registry: 비어 있음
- transport: 미구현

즉, SmartThings command handler가 호출되더라도 `docs/kocom_protocol.md`에서 확정되지 않은 패킷은 `encode_or_reject()` 단계에서 차단됩니다.

## API 예시

장치 목록:

```http
GET /api/devices
```

상태:

```http
GET /api/devices/{deviceId}/status
```

조명/콘센트/가전 ON:

```json
{ "action": "switch.set", "value": "on" }
```

난방 설정온도:

```json
{ "action": "heating.setSetpoint", "value": 24 }
```

환기:

```json
{ "action": "ventilation.setLevel", "value": "medium" }
```

## 로그

`/logs` 화면에서 최근 API 이벤트를 봅니다.

현재 1차 버전 로그는 프로세스 메모리에 최대 300개를 유지하며, 로컬 개발에서는 `logs/dev-events.ndjson`에도 추가 기록합니다.

서버리스/Vercel 환경의 로컬 파일 시스템은 영구 저장소가 아니므로 운영 로그가 필요하면 다음 단계에서 별도 로그 저장소를 붙이는 것이 좋습니다. Supabase는 사용하지 않아도 됩니다.

## 다음 단계

1. 실제 SmartThings 장치 목록/`capabilities.raw` 수집
2. KOCOM Edge Driver 등록 및 가상 장치 생성
3. RS485 버스 **수신 전용 캡처**
4. `docs/kocom_protocol.md`에 실제 패킷 기록
5. 상태 수신 파싱부터 구현
6. 검증된 패킷만 제한적으로 TX 구현
7. Samsung appliance별 추가 capability UI 확장
8. 운영용 인증/접근 제어 및 영구 로그 저장소 추가

## 명령 API 회귀 검증 (2026-09-10)

`Unsupported or invalid command payload`는 SmartThings 오류가 아니라 앱의 요청 파서 오류였습니다.
기존 커밋 `72fa5c7`이 `appliance.start`를 추가했으며, 배포본에 존재하지 않는 장치 ID로
해당 요청을 보내 `SmartThings device not found`가 반환되는 것으로 파서 수정 반영을 확인했습니다.
실제 가전 시작은 이 진단에서 실행하지 않았습니다.

```json
{ "action": "appliance.start" }
```

현재 파서는 `lib/command-parser.ts`에 있으며 HTTP 오류에 `INVALID_COMMAND`,
`COMMAND_REJECTED`, `SMARTTHINGS_API_ERROR` 코드를 포함합니다.
SmartThings HTTP 실패는 502로 구별하고, 토큰은 계속 서버에서만 사용합니다.

Node.js 24에서 `pnpm test`, `pnpm typecheck`, `pnpm build`로 검증합니다.
Mock 세탁기와 식기세척기는 시작 후 running 상태로 바뀌어 UI/API 흐름을 시험할 수 있습니다.
전체 장치는 상태 API를 조회하고 화면의 장치 상태 새로고침으로 다시 읽습니다.
명령 접수는 실제 동작 완료를 뜻하지 않습니다.

후속 연동 범위와 검증 결과는 `docs/development-status.md`를 참고하세요.
