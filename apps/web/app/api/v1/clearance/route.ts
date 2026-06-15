import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clearanceType = searchParams.get("clearanceType");
    const status = searchParams.get("status");
    
    const whereClause: any = {};
    if (clearanceType) whereClause.clearanceType = clearanceType;
    if (status) whereClause.status = status;

    const clearances = await prisma.clearanceRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          select: {
            id: true,
            name: true
          }
        },
        company: {
          select: {
            companyName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json({ success: true, data: clearances });
  } catch (error: any) {
    console.error("GET /api/v1/clearance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validate employee and load active deployments/relations
    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      include: {
        company: true,
        departmentRef: true,
        designation: true,
        defaultProject: true,
        defaultSite: true,
        deployments: {
          where: {
            deploymentDate: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999))
            }
          },
          include: {
            project: true,
            site: true
          },
          take: 1
        }
      }
    });

    if (!employee) {
      return NextResponse.json({ success: false, error: "Employee not found" }, { status: 404 });
    }

    // Resolve "Working For" priority:
    // 1. active project/site assignment
    // 2. default project/site
    // 3. company + department
    // 4. company
    // 5. Not set
    let workingFor = "Not set";
    const activeDeployment = employee.deployments?.[0];
    if (activeDeployment?.project?.projectName) {
      workingFor = activeDeployment.project.projectName;
      if (activeDeployment.site?.siteName) {
        workingFor += ` — ${activeDeployment.site.siteName}`;
      }
    } else if (employee.defaultProject?.projectName) {
      workingFor = employee.defaultProject.projectName;
      if (employee.defaultSite?.siteName) {
        workingFor += ` — ${employee.defaultSite.siteName}`;
      }
    } else if (employee.company?.companyName && employee.departmentRef?.name) {
      workingFor = `${employee.company.companyName} — ${employee.departmentRef.name}`;
    } else if (employee.company?.companyName) {
      workingFor = employee.company.companyName;
    }

    // Generate Clearance Number
    const year = new Date().getFullYear();
    const count = await prisma.clearanceRequest.count();
    const clearanceNumber = `CLR-${year}-${String(count + 1).padStart(4, '0')}`;

    const newClearance = await prisma.clearanceRequest.create({
      data: {
        clearanceNumber,
        formCode: "26-12-2020",
        issueRef: "FM-14-04-02",
        issueDate: "26th DEC, 2020",
        employeeId: employee.id,
        companyId: employee.companyId,
        clearanceType: data.clearanceType,
        separationType: data.separationType,
        typeOfProcess: data.typeOfProcess,
        departureDate: data.departureDate ? new Date(data.departureDate) : null,
        returningDate: data.returningDate ? new Date(data.returningDate) : null,
        lastWorkingDate: data.lastWorkingDate ? new Date(data.lastWorkingDate) : null,
        requestedById: data.requestedById || "system",
        
        // Snapshots
        dateOfJoiningSnapshot: employee.dateOfJoining ? employee.dateOfJoining.toISOString() : null,
        employeeCodeSnapshot: employee.id,
        employeeNameSnapshot: employee.name,
        designationSnapshot: employee.designation?.name || "N/A",
        workingForSnapshot: workingFor,
        qidNumberSnapshot: employee.qidNumber || null,
        qidExpiryDateSnapshot: employee.qidExpiryDate ? employee.qidExpiryDate.toISOString() : null,
        
        status: data.status || "DRAFT"
      }
    });

    // Create steps immediately if templateId is provided
    if (data.templateId) {
      const template = await prisma.clearanceTemplate.findUnique({
        where: { id: data.templateId },
        include: { sections: true }
      });
      if (template) {
        for (const section of template.sections) {
          const override = data.overrides?.find((o: any) => o.sectionName === section.sectionName);
          const isApplicable = override !== undefined ? override.isApplicable : section.isRequiredByDefault;
          const assignedApproverId = override?.assignedApproverId || section.defaultApproverId;
          const notApplicableReason = override?.notApplicableReason || (isApplicable ? null : "Not Applicable");
          const notes = override?.notes || null;

          await prisma.clearanceApprovalStep.create({
            data: {
              clearanceRequestId: newClearance.id,
              stepOrder: section.stepOrder,
              sectionName: section.sectionName,
              isApplicable,
              notApplicableReason,
              status: isApplicable ? "PENDING" : "NOT_APPLICABLE",
              assignedApproverId,
              fallbackRole: section.defaultApproverRole,
              notes
            }
          });
        }
      }
    }
    
    // Create history
    await prisma.clearanceHistory.create({
      data: {
        clearanceRequestId: newClearance.id,
        actorId: data.requestedById || "system",
        actionType: data.status === "PENDING_EMPLOYEE_SIGNATURE" ? "SUBMITTED" : "CREATED",
        details: data.status === "PENDING_EMPLOYEE_SIGNATURE" 
          ? `Clearance request submitted and waiting for employee signature.`
          : `Clearance request drafted for ${employee.name}`
      }
    });

    return NextResponse.json({ success: true, data: newClearance });
  } catch (error: any) {
    console.error("POST /api/v1/clearance error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
