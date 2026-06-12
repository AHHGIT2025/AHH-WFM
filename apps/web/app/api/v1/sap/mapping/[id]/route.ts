import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function PUT(request: Request, { params }: RouteParams) {
  const auth = await checkApiAuth(["ADMIN"]);
  if (auth.error) return auth.error;

  try {
    const { status } = await request.json();
    if (!status) {
      return NextResponse.json({ error: "Missing status" }, { status: 400 });
    }
    const result = await mockDb.updateSapFieldMapping(params.id, { isActive: status === "Mapped" });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to update SAP mapping status" }, { status: 500 });
  }
}
