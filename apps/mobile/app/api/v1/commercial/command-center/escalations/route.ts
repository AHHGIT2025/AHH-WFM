import { NextResponse } from "next/server";

const WEB_API_URL = process.env.WEB_API_URL || process.env.NEXT_PUBLIC_WEB_API_URL || "http://localhost:3100";

export async function GET(request: Request) {
  try {
    const { search } = new URL(request.url);
    const targetUrl = `${WEB_API_URL}/api/v1/commercial/command-center/escalations${search}`;

    const headers: Record<string, string> = {};
    const cookie = request.headers.get("cookie");
    if (cookie) headers["cookie"] = cookie;
    const auth = request.headers.get("authorization");
    if (auth) headers["authorization"] = auth;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers,
      cache: "no-store"
    });

    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate"
      }
    });
  } catch (error: any) {
    console.error("MOBILE BFF ESCALATIONS LIST PROXY ERROR:", error);
    return NextResponse.json(
      { error: "Failed to connect to authoritative Escalations API." },
      { status: 502 }
    );
  }
}
