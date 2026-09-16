import { NextResponse } from "next/server";
export async function POST(request: Request) {
  const origin = process.env.APP_ORIGIN;
  if (!origin || request.headers.get("origin") !== origin) return new NextResponse(null, { status: 403 });
  const response = NextResponse.redirect(`${origin}/connect`, 303);
  response.cookies.set("home_session", "", { maxAge: 0, path: "/", httpOnly: true, secure: origin.startsWith("https://"), sameSite: "lax" });
  return response;
}
