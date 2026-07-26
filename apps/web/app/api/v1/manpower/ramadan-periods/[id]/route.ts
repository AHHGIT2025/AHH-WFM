import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.advisory.view" });
  if (auth.error) return auth.error;

  const period = await prisma.manpowerRamadanPeriod.findUnique({
    where: { id: params.id }
  });

  if (!period) {
    return NextResponse.json({ error: "Ramadan period not found" }, { status: 404 });
  }

  return NextResponse.json({ period });
}
