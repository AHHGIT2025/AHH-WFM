import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

function maskNumber(num: string | null | undefined): string | null {
  if (!num) return null;
  const clean = num.trim();
  if (clean.length <= 4) return clean;
  return "*".repeat(clean.length - 4) + clean.substring(clean.length - 4);
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: (session?.user as any)?.id },
      include: {
        company: true,
        departmentRef: true,
        designation: true,
        tradeClassification: true,
        defaultProject: true,
        defaultSite: true,
        defaultLocation: true,
        officeLocation: true,
        immediateSupervisor: true
      }
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: employee.id,
      employeeId: employee.id,
      name: employee.name,
      email: employee.email,
      phone: employee.phone,
      role: employee.role,
      profilePhotoUrl: employee.profilePhotoUrl,
      profilePhotoUpdatedAt: employee.profilePhotoUpdatedAt,
      companyId: employee.companyId,
      company: employee.company ? {
        id: employee.company.id,
        name: employee.company.companyName,
        code: employee.company.companyCode
      } : null,
      departmentId: employee.departmentId,
      department: employee.departmentRef ? {
        id: employee.departmentRef.id,
        name: employee.departmentRef.name
      } : { name: employee.department },
      designationId: employee.designationId,
      designation: employee.designation ? {
        id: employee.designation.id,
        name: employee.designation.name,
        code: employee.designation.code
      } : null,
      tradeClassification: employee.tradeClassification ? {
        id: employee.tradeClassification.id,
        name: employee.tradeClassification.name
      } : null,
      immediateSupervisor: employee.immediateSupervisor ? {
        id: employee.immediateSupervisor.id,
        name: employee.immediateSupervisor.name
      } : null,
      reportingManagerId: employee.reportingManagerId, // Just keeping ID if needed
      employeeCategory: employee.employeeCategory,
      dutyStatus: employee.dutyStatus,
      defaultLocation: employee.defaultLocation ? {
        id: employee.defaultLocation.id,
        name: employee.defaultLocation.locationName
      } : null,
      defaultSite: employee.defaultSite ? {
        id: employee.defaultSite.id,
        name: employee.defaultSite.siteName
      } : null,
      officeLocation: employee.officeLocation ? {
        id: employee.officeLocation.id,
        name: employee.officeLocation.locationName
      } : null,
      isSupervisor: employee.role === "SUPERVISOR" || employee.role === "ADMIN",
      
      // Identity fields for mobile
      dateOfJoining: employee.dateOfJoining ? employee.dateOfJoining.toISOString() : null,
      qidNumber: employee.qidNumber ? maskNumber(employee.qidNumber) : null,
      qidExpiryDate: employee.qidExpiryDate ? employee.qidExpiryDate.toISOString() : null
    });

  } catch (error) {
    console.error("GET /me Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
