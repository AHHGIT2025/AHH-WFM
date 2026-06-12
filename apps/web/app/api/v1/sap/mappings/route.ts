import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET() {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const mappings = await mockDb.getSapFieldMappings();
    return NextResponse.json(mappings);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch field mappings" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.module || !body.sourceField || !body.targetField) {
      return NextResponse.json({ error: "Missing module, sourceField, or targetField parameters" }, { status: 400 });
    }

    const mapping = await mockDb.createSapFieldMapping(body);
    return NextResponse.json(mapping, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create field mapping" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR"]);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: "Missing mapping id parameter" }, { status: 400 });
    }

    const mapping = await mockDb.updateSapFieldMapping(body.id, body);
    return NextResponse.json(mapping);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update field mapping" }, { status: 500 });
  }
}
