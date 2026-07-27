import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "settings.view" });
  if (auth.error) return auth.error;

  const scopes = await (prisma as any).manpowerDepartmentOperationScope.findMany({
    where: { departmentId: params.id, isActive: true }
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

    // Verify parent company has this operation scope
    const dept = await prisma.department.findUnique({ where: { id: params.id } });
    if (!dept || !dept.companyId) {
      return NextResponse.json({ success: false, error: "Department or parent company not found" }, { status: 400 });
    }

    const companyScope = await (prisma as any).manpowerCompanyOperationScope.findFirst({
      where: { companyId: dept.companyId, operationType: body.operationType, isActive: true }
    });

    if (!companyScope) {
      return NextResponse.json({
        success: false,
        error: "DEPARTMENT_SCOPE_FORBIDDEN: Cannot assign operation scope to department when parent company does not possess it"
      }, { status: 400 });
    }

    const created = await (prisma as any).manpowerDepartmentOperationScope.upsert({
      where: { departmentId_operationType: { departmentId: params.id, operationType: body.operationType } },
      update: { isActive: true },
      create: { departmentId: params.id, operationType: body.operationType, isActive: true }
    });

    await (prisma as any).userActionAudit.create({
      data: {
        userId: auth.session?.user?.id || "SYSTEM",
        action: "ADD_DEPARTMENT_OPERATION_SCOPE",
        targetEntity: "ManpowerDepartmentOperationScope",
        targetId: created.id,
        details: { departmentId: params.id, operationType: body.operationType }
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

    const updated = await (prisma as any).manpowerDepartmentOperationScope.updateMany({
      where: { departmentId: params.id, operationType: operationType as any },
      data: { isActive: false }
    });

    await (prisma as any).userActionAudit.create({
      data: {
        userId: auth.session?.user?.id || "SYSTEM",
        action: "DEACTIVATE_DEPARTMENT_OPERATION_SCOPE",
        targetEntity: "Department",
        targetId: params.id,
        details: { departmentId: params.id, operationType }
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
