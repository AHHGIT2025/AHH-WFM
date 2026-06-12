import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const mappings = await mockDb.getSapMappings();
    return NextResponse.json(mappings);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch SAP mappings" }, { status: 500 });
  }
}
