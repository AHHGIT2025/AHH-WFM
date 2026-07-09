import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage") &&
      !hasPermission(auth.session?.user, "security.scheduling.assign")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { assignmentId } = payload;

    if (!assignmentId) {
      return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
    }

    const isDb = isDbConnected();
    let asgData: any = null;
    let depDateStr = "";

    if (isDb) {
      asgData = await prisma.manpowerDeploymentAssignment.findUnique({
        where: { id: assignmentId },
        include: { deployment: true, employee: true }
      });
      if (asgData) {
        depDateStr = asgData.deployment.date.toISOString().split("T")[0];
      }
    } else {
      const db = readDb() as any;
      const asg = (db.manpowerDeploymentAssignments || []).find((x: any) => x.id === assignmentId);
      if (asg) {
        const dep = (db.manpowerDeployments || []).find((d: any) => d.id === asg.deploymentId);
        if (dep) {
          depDateStr = String(dep.date).split("T")[0];
        }
        const emp = (db.employees || []).find((e: any) => e.id === asg.employeeId);
        asgData = { ...asg, deployment: dep, employee: emp };
      }
    }

    if (!asgData) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Verify operations period lock
    const period = depDateStr.substring(0, 7); // "YYYY-MM"
    const locks = await mockDb.getSecurityOperationsPeriodLocks("SECURITY_GUARDING");
    const isLocked = locks.some(l => l.period === period && l.locked);
    if (isLocked) {
      return NextResponse.json({ error: `Security Guarding operations for period ${period} are locked. Modifications are blocked.` }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    if (isDb) {
      const depDate = asgData.deployment.date.toISOString().split("T")[0];

      if (depDate < todayStr) {
        // Historical: Mark status as CANCELLED
        const prevWarnings = typeof asgData.validationWarnings === "object" ? (asgData.validationWarnings as any) : {};
        await prisma.manpowerDeploymentAssignment.update({
          where: { id: assignmentId },
          data: {
            validationWarnings: {
              ...prevWarnings,
              status: "CANCELLED"
            }
          }
        });
      } else {
        // Future / Present: delete assignment slot
        await prisma.manpowerDeploymentAssignment.delete({
          where: { id: assignmentId }
        });
      }
    } else {
      const db = readDb() as any;
      const asgs = db.manpowerDeploymentAssignments || [];
      const asgIndex = asgs.findIndex((x: any) => x.id === assignmentId);
      
      const asg = asgs[asgIndex];
      const dep = (db.manpowerDeployments || []).find((d: any) => d.id === asg.deploymentId);
      const depDate = String(dep?.date || "").split("T")[0];

      if (depDate < todayStr) {
        // Historical: Cancel
        db.manpowerDeploymentAssignments[asgIndex].status = "CANCELLED";
      } else {
        // Delete
        db.manpowerDeploymentAssignments.splice(asgIndex, 1);
      }
      writeDb(db);
    }

    await mockDb.createUserActivityLog({
      userId: (auth.session?.user as any)?.id || "system",
      action: "UNASSIGN_GUARD",
      entityType: "ManpowerDeploymentAssignment",
      entityId: assignmentId,
      beforeJson: JSON.stringify(asgData),
      afterJson: undefined,
      ipAddress: undefined,
      userAgent: undefined
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Failed to unassign scheduling deployment:", error);
    return NextResponse.json({
      success: false,
      error: error.message || String(error)
    }, { status: 500 });
  }
}
