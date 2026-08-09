import { NextResponse } from "next/server";
import { getWebApiBaseUrl } from "../../../../../../../lib/server-config";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const webApiBase = getWebApiBaseUrl();
    const targetUrl = `${webApiBase}/api/v1/commercial/command-center/escalations/${params.id}`;

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
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("MOBILE BFF ESCALATION DETAIL PROXY ERROR:", error);
    return NextResponse.json(
      { error: "Failed to connect to authoritative Escalation Detail API." },
      { status: 502 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const webApiBase = getWebApiBaseUrl();
    const body = await request.json();
    const targetUrl = `${webApiBase}/api/v1/commercial/command-center/escalations/${params.id}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    const cookie = request.headers.get("cookie");
    if (cookie) headers["cookie"] = cookie;
    const auth = request.headers.get("authorization");
    if (auth) headers["authorization"] = auth;

    const res = await fetch(targetUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("MOBILE BFF ESCALATION ACTION PROXY ERROR:", error);
    return NextResponse.json(
      { error: "Failed to connect to authoritative Escalation Action API." },
      { status: 502 }
    );
  }
}
