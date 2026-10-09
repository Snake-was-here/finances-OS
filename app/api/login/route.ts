import { NextResponse } from "next/server";
import { sessionValue, validPassword } from "../auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!validPassword(body.password)) return NextResponse.json({ error: "Neteisingas slaptažodis" }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("finances_session", sessionValue(), { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
  return response;
}
