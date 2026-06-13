import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

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
        officeLocation: true
      }
    });

    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      company: employee.company?.companyName,
      companyCode: employee.company?.companyCode,
      companyId: employee.company?.id,
      department: employee.departmentRef?.name || employee.department,
      designation: employee.designation?.name,
      trade: employee.tradeClassification?.name,
      workerCategory: employee.workerCategory,
      dutyStatus: employee.dutyStatus,
      defaultLocation: employee.officeLocation?.locationName || employee.defaultLocation?.locationName,
      isSupervisor: employee.role === "SUPERVISOR" || employee.role === "ADMIN",
    });

  } catch (error) {
    console.error("GET /me Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
