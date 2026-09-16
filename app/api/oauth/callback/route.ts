import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { consumeState, exchange, oauthConfig, oauthEnabled, saveConnection } from "@/smartthings/oauth";
import { validSession } from "@/smartthings/oauth-core";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!oauthEnabled()) return new NextResponse(null, { status: 404 });
  const c = oauthConfig();
  let result = "connection";
  try {
    const url = new URL(request.url), jar = await cookies(), browser = jar.get("home_session")?.value;
    const state = url.searchParams.get("state"), code = url.searchParams.get("code");
    if (!browser || !validSession(browser, process.env.HOME_ACCESS_KEY) || !state || !/^[a-f0-9]{64}$/.test(state) ||
        !await consumeState(state, browser)) throw new Error("Invalid state");
    if (url.searchParams.has("error") || !code || code.length > 4096) throw new Error("Authorization denied");
    const tokens = await exchange({ grant_type: "authorization_code", code, redirect_uri: c.redirectUri });
    await saveConnection(tokens);
    result = "connected";
  } catch { /* Never log callback URLs or credential-bearing responses. */ }
  const response = NextResponse.redirect(`${c.origin}/connect?${result === "connected" ? "success=1" : `error=${result}`}`, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
