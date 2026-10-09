import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validSession } from "../auth";

export async function GET() {
  const store = await cookies();
  if (!validSession(store.get("finances_session")?.value)) return NextResponse.json({ error: "Užrakinta" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
