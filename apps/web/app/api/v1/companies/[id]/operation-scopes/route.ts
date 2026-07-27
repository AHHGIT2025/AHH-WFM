import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "settings.view" });
  if (auth.error) return auth.error;

  const scopes = await (prisma as any).manpowerCompanyOperationScope.findMany({
    where: { companyId: params.id, isActive: true }
  });

  return NextResponse.json({ success: true, data: scopes });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "settings.manage" });
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    if (!body.operationType) {
      return NextResponse.json({ success: false, error: "operationType is required" }, { status: 400 });
    }

    const created = await (prisma as any).manpowerCompanyOperationScope.upsert({
      where: { companyId_operationType: { companyId: params.id, operationType: body.operationType } },
      update: { isActive: true },
      create: { companyId: params.id, operationType: body.operationType, isActive: true }
    });

    await (prisma as any).userActionAudit.create({
      data: {
        userId: auth.session?.user?.id || "SYSTEM",
        action: "ADD_COMPANY_OPERATION_SCOPE",
        targetEntity: "ManpowerCompanyOperationScope",
        targetId: created.id,
        details: { companyId: params.id, operationType: body.operationType }
      }
    });

    return NextResponse.json({ success: true, data: created });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "settings.manage" });
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const operationType = searchParams.get("operationType");

    if (!operationType) {
      return NextResponse.json({ success: false, error: "operationType query parameter is required" }, { status: 400 });
    }

    const updated = await (prisma as any).manpowerCompanyOperationScope.updateMany({
      where: { companyId: params.id, operationType: operationType as any },
      data: { isActive: false }
    });

    await (prisma as any).userActionAudit.create({
      data: {
        userId: auth.session?.user?.id || "SYSTEM",
        action: "DEACTIVATE_COMPANY_OPERATION_SCOPE",
        targetEntity: "Company",
        targetId: params.id,
        details: { companyId: params.id, operationType }
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
