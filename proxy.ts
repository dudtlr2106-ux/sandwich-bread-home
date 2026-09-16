import { NextRequest, NextResponse } from "next/server";
import { validSession } from "./smartthings/oauth-core";

export function proxy(request: NextRequest) {
  if (process.env.SMARTTHINGS_AUTH_MODE !== "oauth") return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (path === "/connect" || path === "/api/oauth/login" || path === "/api/oauth/callback") return NextResponse.next();
  if (!validSession(request.cookies.get("home_session")?.value, process.env.HOME_ACCESS_KEY)) {
    return path.startsWith("/api/") ? NextResponse.json({ error: "우리집 접속 암호로 로그인해주세요." }, { status: 401 }) :
      NextResponse.redirect(new URL("/connect", request.url));
  }
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== process.env.APP_ORIGIN) {
    return NextResponse.json({ error: "앱에서 다시 요청해주세요." }, { status: 403 });
  }
  return NextResponse.next();
}
export const config = { matcher: ["/", "/logs", "/connect", "/api/:path*"] };
