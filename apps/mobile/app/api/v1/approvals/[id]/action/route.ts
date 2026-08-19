import { NextResponse } from "next/server";
import { getWebApiBaseUrl } from "../../../../../../lib/server-config";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const webApiBase = getWebApiBaseUrl();
    const targetUrl = `${webApiBase}/api/v1/approvals/${encodeURIComponent(params.id)}/action`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    const cookie = request.headers.get("cookie");
    if (cookie) headers["cookie"] = cookie;
    const auth = request.headers.get("authorization");
    if (auth) headers["authorization"] = auth;

    const body = await request.text();

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body,
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
    console.error("MOBILE BFF APPROVAL ACTION PROXY ERROR:", error);
    return NextResponse.json(
      { error: "Failed to execute action via authoritative Universal Approvals API." },
      { status: 502 }
    );
  }
}
