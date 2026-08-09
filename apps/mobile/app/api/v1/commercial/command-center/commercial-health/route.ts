import { NextResponse } from "next/server";
import { getWebApiBaseUrl } from "../../../../../../lib/server-config";

export async function GET(request: Request) {
  try {
    const webApiBase = getWebApiBaseUrl();
    const { search } = new URL(request.url);
    const targetUrl = `${webApiBase}/api/v1/commercial/command-center/commercial-health${search}`;

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
    console.error("MOBILE BFF COMMERCIAL HEALTH PROXY ERROR:", error);
    return NextResponse.json(
      { error: "Failed to connect to authoritative Commercial Health API." },
      { status: 502 }
    );
  }
}
