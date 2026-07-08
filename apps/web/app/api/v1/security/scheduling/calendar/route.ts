import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

function parseDate(val: any): string {
  if (!val) return new Date().toISOString().split("T")[0];
  if (val instanceof Date) return val.toISOString().split("T")[0];
  return String(val).split("T")[0];
}

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view") &&
      !hasPermission(auth.session?.user, "security.scheduling.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || undefined;
  const contractId = searchParams.get("contractId") || undefined;
  const projectId = searchParams.get("projectId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;
  const startDateStr = searchParams.get("startDate") || searchParams.get("date") || new Date().toISOString().split("T")[0];
  const endDateStr = searchParams.get("endDate") || startDateStr;

  try {
    if (siteId && siteId !== "all" && siteId !== "undefined" && siteId !== "null") {
      const db = readDb() as any;
      const siteAllocations = (db.siteManpowerAllocations || []).filter((a: any) => a.siteId === siteId);
      const totalAllocated = siteAllocations.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
      if (totalAllocated === 0) {
        return NextResponse.json({
          success: false,
          error: "No manpower allocated to this site. Allocate manpower before scheduling."
        }, { status: 400 });
      }

      const isDb = isDbConnected();
      let shiftCount = 0;
      if (isDb) {
        shiftCount = await prisma.manpowerShiftRequirement.count({
          where: { siteId, isActive: true }
        });
      } else {
        const shifts = (db.shiftRequirements || []).filter((s: any) => s.siteId === siteId && s.isActive !== false);
        shiftCount = shifts.length;
      }
      if (shiftCount === 0) {
        return NextResponse.json({
          success: false,
          error: "No site shifts configured. Configure site shifts before scheduling."
        }, { status: 400 });
      }
    }

    // Determine database mode
    const isDb = isDbConnected();

    // Load necessary models safely
    let sites: any[] = [];
    let projects: any[] = [];
    let contracts: any[] = [];
    let shiftRequirements: any[] = [];
    let deployments: any[] = [];
    let assignments: any[] = [];
    let relievers: any[] = [];
    let clients: any[] = [];

    if (isDb) {
      sites = await prisma.manpowerSite.findMany({ where: { operationType: "SECURITY_GUARDING" } });
      projects = await prisma.manpowerProject.findMany({ where: { operationType: "SECURITY_GUARDING" } });
      contracts = await prisma.manpowerContract.findMany();
      shiftRequirements = await prisma.manpowerShiftRequirement.findMany({ where: { operationType: "SECURITY_GUARDING" } });
      
      const start = new Date(startDateStr);
      start.setHours(0,0,0,0);
      const end = new Date(endDateStr);
      end.setHours(23,59,59,999);
      
      deployments = await prisma.manpowerDeployment.findMany({
        where: {
          operationType: "SECURITY_GUARDING",
          date: { gte: start, lte: end }
        },
        include: {
          assignments: {
            include: {
              employee: true,
              relieverAssignments: {
                include: {
                  relieverEmployee: true
                }
              }
            }
          }
        }
      });
    } else {
      const db = readDb() as any;
      sites = (db.manpowerSites || []).filter((s: any) => s.operationType === "SECURITY_GUARDING");
      projects = (db.manpowerProjects || []).filter((p: any) => p.operationType === "SECURITY_GUARDING");
      contracts = db.manpowerContracts || [];
      shiftRequirements = (db.shiftRequirements || []).filter((r: any) => r.operationType === "SECURITY_GUARDING");
      
      const start = startDateStr;
      const end = endDateStr;
      
      const rawDeps = (db.manpowerDeployments || []).filter((d: any) => {
        const dStr = parseDate(d.date);
        return dStr >= start && dStr <= end && d.operationType === "SECURITY_GUARDING";
      });

      const rawAsgs = db.manpowerDeploymentAssignments || [];
      const rawRels = db.manpowerRelieverAssignments || [];
      const employees = db.employees || [];

      deployments = rawDeps.map((d: any) => {
        const asgs = rawAsgs.filter((a: any) => a.deploymentId === d.id).map((a: any) => {
          const emp = employees.find((e: any) => e.id === a.employeeId);
          const rels = rawRels.filter((r: any) => r.originalAssignmentId === a.id).map((r: any) => {
            const remp = employees.find((e: any) => e.id === r.relieverEmployeeId);
            return {
              ...r,
              relieverEmployee: remp
            };
          });
          return {
            ...a,
            employee: emp,
            relieverAssignments: rels
          };
        });
        return {
          ...d,
          assignments: asgs
        };
      });
    }

    // Filter sites/projects by client/contract
    const filteredSites = sites.filter(s => {
      if (s.isActive === false) return false;
      if (siteId && siteId !== "all" && s.id !== siteId) return false;
      if (projectId && projectId !== "all" && s.projectId !== projectId) return false;
      const proj = projects.find(p => p.id === s.projectId);
      if (!proj) return false;
      if (contractId && contractId !== "all" && proj.contractId !== contractId) return false;
      const contr = contracts.find(c => c.id === proj.contractId);
      if (!contr) return false;
      if (clientId && clientId !== "all" && contr.clientId !== clientId) return false;
      return true;
    });

    const siteIds = filteredSites.map(s => s.id);
    const filteredRequirements = shiftRequirements.filter(r => siteIds.includes(r.siteId));

    // Construct slots and map assignments
    const slots = filteredRequirements.map(req => {
      const site = filteredSites.find(s => s.id === req.siteId);
      const proj = projects.find(p => p.id === site?.projectId);
      const contr = contracts.find(c => c.id === proj?.contractId);

      // Find deployments matching this shift requirement
      const reqDeps = deployments.filter(d => d.shiftRequirementId === req.id);
      
      const mappedAssignments: any[] = [];
      reqDeps.forEach(dep => {
        (dep.assignments || []).forEach((asg: any) => {
          const emp = asg.employee;
          const status = asg.status || (asg.validationWarnings ? "WARNING" : "ASSIGNED");
          
          mappedAssignments.push({
            id: asg.id,
            deploymentId: dep.id,
            employeeId: emp?.id,
            employeeCode: emp?.employeeCode || emp?.id,
            employeeName: emp?.name,
            designation: emp?.designationId || emp?.designationName,
            grade: emp?.salaryGrade || emp?.grade,
            shiftStartTime: req.shiftStartTime,
            shiftEndTime: req.shiftEndTime,
            shiftCode: req.shiftCode,
            postName: req.locationUnitId || "Post HQ",
            status,
            isReliever: asg.isReliever,
            isOvertime: asg.isOvertime,
            validationStatus: asg.validationStatus || (asg.validationWarnings ? "WARNING" : "OK"),
            validationIssues: asg.validationWarnings || [],
            payrollAdvisories: asg.payrollAdvisory || [],
            overrideReason: asg.overrideReason || "",
            overriddenBy: asg.overriddenBy || "",
            overriddenAt: asg.overriddenAt || ""
          });

          // Reliever assignments mapping
          (asg.relieverAssignments || []).forEach((r: any) => {
            const remp = r.relieverEmployee;
            mappedAssignments.push({
              id: r.id,
              deploymentId: dep.id,
              employeeId: remp?.id,
              employeeCode: remp?.employeeCode || remp?.id,
              employeeName: remp?.name,
              designation: remp?.designationId || remp?.designationName,
              grade: remp?.salaryGrade || remp?.grade,
              shiftStartTime: req.shiftStartTime,
              shiftEndTime: req.shiftEndTime,
              shiftCode: req.shiftCode,
              postName: req.locationUnitId || "Post HQ",
              status: "RELIEVER",
              isReliever: true,
              isOvertime: false,
              validationStatus: "OK",
              validationIssues: [],
              payrollAdvisories: ["Reliever duty advisory may apply."],
              overrideReason: r.reason || ""
            });
          });
        });
      });

      return {
        id: req.id,
        siteId: req.siteId,
        siteName: site?.name || "Unnamed Site",
        projectCode: proj?.code,
        contractCode: contr?.contractNumber || contr?.id,
        postName: req.locationUnitId || "Post HQ",
        shiftCode: req.shiftCode,
        shiftStartTime: req.shiftStartTime,
        shiftEndTime: req.shiftEndTime,
        requiredCount: req.requiredCount,
        assignedCount: mappedAssignments.length,
        coverageStatus: mappedAssignments.length >= req.requiredCount ? "FULL" : mappedAssignments.length > 0 ? "PARTIAL" : "VACANT",
        assignments: mappedAssignments
      };
    });

    // Coverage Summary Metrics
    let requiredManpower = 0;
    let assignedManpower = 0;
    let vacantPosts = 0;
    let warningDeployments = 0;
    let relieversCount = 0;

    slots.forEach(slot => {
      requiredManpower += slot.requiredCount;
      assignedManpower += slot.assignedCount;
      if (slot.assignedCount === 0) {
        vacantPosts++;
      }
      slot.assignments.forEach((asg: any) => {
        if (asg.validationStatus === "WARNING") warningDeployments++;
        if (asg.isReliever) relieversCount++;
      });
    });

    const summary = {
      requiredManpower,
      assignedManpower,
      vacantPosts,
      overstaffedPosts: slots.filter(s => s.assignedCount > s.requiredCount).length,
      warningDeployments,
      blockedAttempts: 0, // Mock log-based value
      pendingApprovals: deployments.filter(d => d.approvalStatus === "SUBMITTED").length,
      relieversAssigned: relieversCount
    };

    return NextResponse.json({
      success: true,
      summary,
      slots
    });

  } catch (error: any) {
    console.error("Failed to load scheduling calendar API:", error);
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
