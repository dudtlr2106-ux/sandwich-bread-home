# SmartThings 자동 연결 — 최초 설정

코드는 구현되어 있지만 실제 OAuth 앱 등록, Redis 연결, 운영 환경변수 설정과 삼성 계정 승인은 아직 완료되지 않았다. `SMARTTHINGS_AUTH_MODE=oauth`는 아래 설정을 마친 뒤 활성화한다.

## 1. 삼성 OAuth 앱 등록

공식 Quick Start의 현재 CLI 경로를 사용한다. 새 Developer Console의 API Access App 등록은 문서상 아직 coming soon이므로 그 화면이 제공된다고 가정하지 않는다.

```powershell
pnpm dlx @smartthings/cli apps:create -i docs/smartthings-oauth-app.json -j -o .env.oauth-registration.local
```

삼성 로그인 창에서 본인 계정으로 승인한다. `.env.oauth-registration.local`은 이름과 달리 CLI가 저장한 JSON이며 Git에서 제외된다. 응답의 `oauthClientId`, `oauthClientSecret`을 서버 환경변수에 저장한다. 이미 같은 앱이 있다면 새로 생성하지 말고 기존 앱을 확인한다. 인증값을 채팅이나 Git에 붙여넣지 않는다.

이 작업 환경에서는 CLI 앱 목록 조회 중 `unable to get authentication info`로 실패했다. 등록 성공이나 계정 연결 완료로 간주하면 안 된다. 사용자 PC에서 CLI 로그인 여부를 확인하거나 별도의 최초 등록용 인증이 필요하다.

등록값:
- 유형: OAuth-In / API_ONLY
- 이름: 우리집
- Callback: `https://sandwich-bread-home.vercel.app/api/oauth/callback`
- 권한: 장치 조회·실행, 위치 조회. 삭제·기기 등록 권한은 요구하지 않는다.
- 구독/webhook Target URL은 사용하지 않는다. 상태는 조회 방식으로 확인한다.

## 2. 영구 저장소

Vercel 프로젝트 Storage/Marketplace에서 Upstash Redis를 연결한다. 임시 72시간 DB나 서버 메모리를 운영 저장소로 쓰지 않는다. 데이터 삭제/eviction 없는 저장소를 사용한다. 유료 플랜이 필요한 경우 가입 전에 비용을 확인한다.

프로젝트에 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`을 설정한다. Marketplace가 `KV_REST_API_URL` / `KV_REST_API_TOKEN` 이름으로 제공하면 그대로 사용할 수 있다. Preview에는 운영 저장소를 연결하지 않는다.

## 3. Vercel Production 환경변수

| 이름 | 값 |
| --- | --- |
| IOT_MODE | smartthings |
| SMARTTHINGS_AUTH_MODE | oauth |
| APP_ORIGIN | https://sandwich-bread-home.vercel.app |
| SMARTTHINGS_CLIENT_ID | 등록 응답의 oauthClientId |
| SMARTTHINGS_CLIENT_SECRET | 등록 응답의 oauthClientSecret |
| SMARTTHINGS_ENCRYPTION_KEY | 임의 32바이트의 base64 값 |
| HOME_ACCESS_KEY | 가족용 접속 암호, 최소 16자, 삼성 비밀번호와 별도 |
| UPSTASH_REDIS_REST_URL / TOKEN | Redis REST 연결 정보 |

암호화 키 생성 예: `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`. 보안 설정 화면에서만 입력하고 기록을 공개하지 않는다. 키 변경 시 기존 암호문을 읽을 수 없으므로 이전 키를 보존하거나 재연결해야 한다. HOME_ACCESS_KEY 변경은 기존 브라우저 세션을 무효화한다.

환경변수 저장 후 재배포 → `/connect` → 가족용 암호 로그인 → 삼성 계정으로 연결 → 장치 조회 확인. OAuth 모드에서는 기존 PAT으로 자동 복귀하지 않는다.

## 동작과 제한

- 서버 저장소에 AES-256-GCM으로 access/refresh token 쌍을 암호화한다. 브라우저에는 서명된 접속 세션만 둔다.
- 만료 2분 전 또는 명확한 API 401 응답 시 자동 갱신한다. 여러 서버의 갱신은 Redis 잠금과 원자적 저장으로 직렬화한다.
- 갱신 요청이 중간에 끊긴 경우 사용 여부를 알 수 없는 refresh token을 재사용하지 않고 재연결한다.
- OAuth state는 10분, 브라우저에 연결되어 한 번만 소비된다. 명령 POST는 동일 출처에서만 허용한다.
- 접속 세션은 30일이다. 로그아웃은 해당 브라우저만 로그아웃한다. 삼성 연동 해제는 SmartThings 연결된 서비스에서 수행한다. 다음 API 접근에서 취소 여부가 반영된다.
- 백그라운드 스케줄러는 없다. 앱을 오래 사용하지 않아 refresh token이 만료되면 삼성 재승인이 필요하다. 매일 수동 PAT 갱신은 필요하지 않다.
- 집 한 곳에 대한 공유 연결이다. 가족용 암호를 아는 사용자는 기기를 제어하고 삼성 연결을 변경할 수 있다.

## 검사

`node --test tests/*.test.mjs`, `pnpm build`, 빌드 후 `node tests/oauth.integration.mjs` 및 `node tests/smartthings.integration.mjs`.
OAuth 통합 검사는 실제 Next 서버 2개와 로컬 OAuth/Redis 모의 서버를 사용한다. 실제 삼성 계정 승인과 운영 Redis는 최초 설정 후 별도로 검증해야 한다.

공식 문서: https://developer.smartthings.com/docs/getting-started/quickstart
토큰 갱신: https://developer.smartthings.com/docs/service-integrations/token-management
