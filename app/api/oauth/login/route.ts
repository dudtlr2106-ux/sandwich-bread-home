import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { equal, session } from "@/smartthings/oauth-core";
import { oauthConfig, oauthEnabled, redis } from "@/smartthings/oauth";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const origin = process.env.APP_ORIGIN;
  if (!oauthEnabled() || !origin || request.headers.get("origin") !== origin) return new NextResponse(null, { status: 403 });
  try {
    const c = oauthConfig();
    // Global bounded login rate; never trust client-supplied IPs to bypass limits.
    const bucket = `${c.prefix}login:${Math.floor(Date.now() / 60000)}`;
    const attempts = await redis(["INCR", bucket]);
    if (attempts === 1) await redis(["EXPIRE", bucket, 120]);
    if (attempts > 10) return NextResponse.redirect(`${origin}/connect?error=rate`, 303);
    const data = await request.formData();
    const password = data.get("password");
    const hash = (value: string) => createHash("sha256").update(value).digest("hex");
    if (typeof password !== "string" || password.length > 256 || !equal(hash(password), hash(process.env.HOME_ACCESS_KEY!))) {
      return NextResponse.redirect(`${origin}/connect?error=login`, 303);
    }
    const response = NextResponse.redirect(`${origin}/connect`, 303);
    response.cookies.set("home_session", session(process.env.HOME_ACCESS_KEY!), { httpOnly: true, secure: origin.startsWith("https://"), sameSite: "lax", path: "/", maxAge: 30 * 86400 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch { return NextResponse.redirect(`${origin}/connect?error=setup`, 303); }
}
