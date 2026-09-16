import Link from "next/link";
import { cookies } from "next/headers";
import { validSession } from "@/smartthings/oauth-core";
import { oauthConfig, oauthEnabled, readTokens, redis } from "@/smartthings/oauth";
export const dynamic = "force-dynamic";
export default async function Connect({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams, jar = await cookies();
  const loggedIn = validSession(jar.get("home_session")?.value, process.env.HOME_ACCESS_KEY);
  let configured = false, connected = false, needsReconnect = false, unavailable = false;
  if (oauthEnabled()) {
    try { oauthConfig(); configured = true; } catch { /* Only show readiness, never secret values. */ }
    if (configured && loggedIn) {
      try { connected = Boolean(await readTokens()); needsReconnect = Boolean(await redis(["GET", `${oauthConfig().prefix}refresh-pending`])); }
      catch { unavailable = true; }
    }
  }
  const errors: Record<string, string> = { login: "접속 암호를 확인해주세요.", rate: "로그인 시도가 많습니다. 1분 후 다시 시도해주세요.",
    setup: "서버 연결 설정을 확인해주세요.", connection: "연결을 완료하지 못했습니다. 다시 시도해주세요." };
  return <div className="page-wrap"><section className="hero compact"><div><p className="eyebrow">CONNECTION</p><h1>우리집 연결</h1><p>삼성 계정 연결과 우리집 접속을 관리합니다.</p></div></section>
    <section className="empty-state connection-panel">
      {!configured ? <><h2>자동 연결을 준비하고 있어요</h2><p>삼성 앱 등록과 서버 저장소 설정이 완료되면 여기에서 한 번 연결할 수 있습니다.</p><Link href="/">홈으로</Link></> : !loggedIn ? <>
        <h2>우리집 접속</h2><p>가족용 접속 암호를 입력해주세요. 삼성 계정 비밀번호와는 다릅니다.</p>
        <form action="/api/oauth/login" method="post"><label htmlFor="home-password">우리집 접속 암호</label><input id="home-password" name="password" type="password" autoComplete="current-password" required maxLength={256} /><button className="refresh-button">로그인</button></form>
      </> : <><h2>{needsReconnect ? "삼성 계정 재연결이 필요해요" : connected ? "삼성 계정 연결됨" : "삼성 계정 연결"}</h2>
        <p>연결 후에는 앱을 사용할 때 인증을 자동 갱신합니다. 장기간 사용하지 않거나 연결을 해제한 경우 다시 승인이 필요할 수 있습니다.</p>
        {unavailable && <p role="alert">연결 저장소에 접근하지 못했습니다. 잠시 후 다시 확인해주세요.</p>}
        <form action="/api/oauth/start" method="post"><button className="refresh-button">{connected ? "삼성 계정 다시 연결" : "삼성 계정으로 연결"}</button></form>
        {connected && !needsReconnect && <p><Link href="/">장치 보러 가기 →</Link></p>}
        <form action="/api/oauth/logout" method="post"><button className="filter-button">이 브라우저에서 로그아웃</button></form>
        <p>삼성 연결 자체를 해제하려면 SmartThings 앱의 연결된 서비스에서 우리집 앱을 해제해주세요.</p>
      </>}
      {params.error && <p className="alert" role="alert">{errors[params.error] ?? "요청을 완료하지 못했습니다."}</p>}
      {params.success === "1" && loggedIn && connected && <p role="status">연결을 저장했습니다. 이제 매일 토큰을 입력할 필요가 없습니다.</p>}
    </section></div>;
}
