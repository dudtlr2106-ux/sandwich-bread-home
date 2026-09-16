import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { beginState, oauthConfig, oauthEnabled } from "@/smartthings/oauth";
import { validSession } from "@/smartthings/oauth-core";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!oauthEnabled()) return new NextResponse(null, { status: 404 });
  const c = oauthConfig(), jar = await cookies(), browser = jar.get("home_session")?.value;
  if (!browser || !validSession(browser, process.env.HOME_ACCESS_KEY) || request.headers.get("origin") !== c.origin) return new NextResponse(null, { status: 403 });
  try {
    const state = randomBytes(32).toString("hex");
    await beginState(state, browser);
    const url = new URL(`${c.oauthBase}/authorize`);
    url.search = new URLSearchParams({ client_id: c.clientId, response_type: "code", redirect_uri: c.redirectUri,
      scope: "r:devices:* x:devices:* r:locations:*", state }).toString();
    const response = NextResponse.redirect(url, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch { return NextResponse.redirect(`${c.origin}/connect?error=connection`, 303); }
}
