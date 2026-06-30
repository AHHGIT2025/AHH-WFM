import { NextResponse } from "next/server";
import { getNextSequenceCode } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix");

  if (!prefix) {
    return NextResponse.json({ error: "Missing prefix parameter" }, { status: 400 });
  }

  try {
    const code = await getNextSequenceCode(prefix);
    return NextResponse.json({ code });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to generate next code" }, { status: 500 });
  }
}
