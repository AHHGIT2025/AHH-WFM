import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const queue = await mockDb.getSapExportQueue();
    return NextResponse.json(queue);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch export queue" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.connectionId || !body.module) {
      return NextResponse.json({ error: "Missing required parameters: connectionId and module" }, { status: 400 });
    }

    if (body.module !== "LEAVE" && body.module !== "ATTENDANCE" && body.module !== "OVERTIME" && body.module !== "ROSTER") {
      return NextResponse.json({ error: "Unsupported integration module" }, { status: 400 });
    }

    const results = await mockDb.triggerSapExport(body.connectionId, body.module);
    return NextResponse.json({ success: true, count: results.length, data: results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to run SAP export" }, { status: 500 });
  }
}
