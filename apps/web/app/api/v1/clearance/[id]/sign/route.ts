import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";
import { validateClearanceCompanyAndAccess } from "@/lib/clearance-auth";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "clearance.view" });
    if (auth.error) {
      return auth.error;
    }
    const user = auth.session.user;
    const clearanceId = params.id;
    const data = await request.json();
    
    const clearance = await prisma.clearanceRequest.findUnique({
      where: { id: clearanceId },
    });

    if (!clearance) {
      return NextResponse.json({ success: false, error: "Clearance not found" }, { status: 404 });
    }

    const accessError = validateClearanceCompanyAndAccess(user, clearance);
    if (accessError) return accessError;

    // Strict Subject Employee Verification: Only the subject employee may sign
    // No documented business rule permits admin to sign on behalf of an employee.
    const canonicalEmployeeId = user.employeeId || user.id;
    if (clearance.employeeId !== canonicalEmployeeId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Only the subject employee can sign this clearance declaration" },
        { status: 403 }
      );
    }

    if (clearance.status !== "PENDING_EMPLOYEE_SIGNATURE") {
      return NextResponse.json({ success: false, error: "Clearance is not waiting for employee signature" }, { status: 400 });
    }

    await prisma.clearanceRequest.update({
      where: { id: clearanceId },
      data: { 
        employeeSignedAt: new Date(),
        employeeSignatureName: data.signatureName,
        employeeSignatureData: data.signatureData,
        status: "IN_PROGRESS"
      }
    });
    
    await prisma.clearanceHistory.create({
      data: {
        clearanceRequestId: clearance.id,
        actorId: user.id || clearance.employeeId,
        actionType: "SIGNED",
        details: "Employee has signed the clearance declaration."
      }
    });

    return NextResponse.json({ success: true, message: "Clearance signed successfully" });
  } catch (error: any) {
    console.error("POST /api/v1/clearance/[id]/sign error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
