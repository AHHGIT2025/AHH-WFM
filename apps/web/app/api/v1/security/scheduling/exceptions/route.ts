import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

function parseTime(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];

  try {
    const isDb = isDbConnected();
    const db = readDb() as any;

    let deployments: any[] = [];
    let attendanceRecords: any[] = [];
    let leaves: any[] = [];
    let sites: any[] = [];
    let shiftRequirements: any[] = [];
    let employees: any[] = [];

    if (isDb) {
      const start = new Date(dateStr);
      start.setHours(0,0,0,0);
      const end = new Date(dateStr);
      end.setHours(23,59,59,999);

      deployments = await prisma.manpowerDeployment.findMany({
        where: {
          date: { gte: start, lte: end },
          operationType: "SECURITY_GUARDING"
        },
        include: {
          assignments: {
            include: {
              employee: {
                include: {
                  securityLicense: true,
                  securityGatePasses: true
                }
              }
            }
          },
          shiftRequirement: {
            include: {
              category: true
            }
          }
        }
      });

      sites = await prisma.manpowerSite.findMany({
        where: { operationType: "SECURITY_GUARDING" }
      });

      const rawAttendance = await prisma.attendanceRecord.findMany({
        where: {
          checkIn: { gte: start, lte: end },
          employee: {
            operationType: "SECURITY_GUARDING"
          }
        },
        include: {
          employee: true
        }
      });

      attendanceRecords = rawAttendance.map(a => ({
        ...a,
        site: sites.find(s => s.id === a.siteId) || null
      }));

      leaves = await prisma.leaveRequest.findMany({
        where: {
          status: "Approved",
          startDate: { lte: end },
          endDate: { gte: start }
        }
      });

      shiftRequirements = await prisma.manpowerShiftRequirement.findMany({
        where: { operationType: "SECURITY_GUARDING" },
        include: { site: true, category: true }
      });
    } else {
      employees = db.employees || [];
      const securityLicenses = db.securityLicenses || [];
      const securityGatePasses = db.securityGatePasses || [];
      const rawShifts = db.shiftRequirements || [];
      const rawSites = db.manpowerSites || [];
      const rawCats = db.manpowerCategories || [];

      sites = rawSites.filter((s: any) => s.operationType === "SECURITY_GUARDING");
      shiftRequirements = rawShifts.filter((r: any) => r.operationType === "SECURITY_GUARDING").map((r: any) => ({
        ...r,
        site: sites.find((s: any) => s.id === r.siteId) || null,
        category: rawCats.find((c: any) => c.id === r.categoryId) || null
      }));

      const rawDeps = (db.manpowerDeployments || []).filter((d: any) => {
        const dStr = String(d.date).split("T")[0];
        return dStr === dateStr && d.operationType === "SECURITY_GUARDING";
      });

      const rawAsgs = db.manpowerDeploymentAssignments || [];
      deployments = rawDeps.map((d: any) => {
        const req = shiftRequirements.find((r: any) => r.id === d.shiftRequirementId);
        const asgs = rawAsgs.filter((a: any) => a.deploymentId === d.id).map((a: any) => {
          const emp = employees.find((e: any) => e.id === a.employeeId);
          const lic = securityLicenses.find((l: any) => l.employeeId === a.employeeId);
          const gps = securityGatePasses.filter((g: any) => g.employeeId === a.employeeId);
          return {
            ...a,
            employee: emp ? { ...emp, securityLicense: lic || null, securityGatePasses: gps } : null
          };
        });
        return {
          ...d,
          shiftRequirement: req,
          assignments: asgs
        };
      });

      attendanceRecords = (db.attendance || []).filter((a: any) => {
        const aDate = String(a.checkIn || "").split("T")[0];
        if (aDate !== dateStr) return false;
        const emp = employees.find((e: any) => e.id === a.employeeId);
        return emp && emp.operationType === "SECURITY_GUARDING";
      }).map((a: any) => {
        const emp = employees.find((e: any) => e.id === a.employeeId);
        const s = sites.find((x: any) => x.id === a.siteId);
        return {
          ...a,
          employee: emp || null,
          site: s || null
        };
      });

      leaves = (db.leaves || db.leaveRequests || []).filter((l: any) => {
        const isApproved = l.status === "Approved" || l.status === "APPROVED";
        const lStart = !l.startDate && !l.from ? "" : (() => { const v = l.startDate || l.from; if (typeof v === "string") return v.includes("T") ? v.split("T")[0] : v; try { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0]; } catch { return ""; } })();
        const lEnd = !l.endDate && !l.to ? "" : (() => { const v = l.endDate || l.to; if (typeof v === "string") return v.includes("T") ? v.split("T")[0] : v; try { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0]; } catch { return ""; } })();
        return isApproved && dateStr >= lStart && dateStr <= lEnd;
      });
    }

    const exceptions: any[] = [];
    const processedEmployeeIds = new Set<string>();

    // 1. Process Scheduled Assignments
    deployments.forEach(dep => {
      const req = dep.shiftRequirement;
      if (!req) return;

      (dep.assignments || []).forEach((asg: any) => {
        const emp = asg.employee;
        if (!emp) return;

        processedEmployeeIds.add(emp.id);

        const warningsObj = typeof asg.validationWarnings === "object" && asg.validationWarnings ? (asg.validationWarnings as any) : {};
        const overrides = warningsObj.exceptionOverrides || [];

        // Check if there is an attendance record for this employee
        const att = attendanceRecords.find(a => a.employeeId === emp.id);

        // A. Leave Conflict Check
        const onLeave = leaves.some(l => l.employeeId === emp.id);
        if (onLeave) {
          const type = "LEAVE_CONFLICT";
          const resolved = overrides.some((o: any) => o.exceptionType === type);
          exceptions.push({
            id: `exc-${asg.id}-${type}`,
            assignmentId: asg.id,
            date: dateStr,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.employeeCode || emp.id,
            exceptionType: type,
            severity: "BLOCKED",
            message: `Guard scheduled to work on approved leave date.`,
            siteId: req.siteId,
            siteName: req.site?.name,
            plannedShiftCode: req.shiftCode,
            plannedStartTime: req.shiftStartTime,
            plannedEndTime: req.shiftEndTime,
            resolved,
            overrideReason: resolved ? overrides.find((o: any) => o.exceptionType === type)?.reason : undefined
          });
        }

        if (!att) {
          // B. No-Show
          const type = "NO_SHOW";
          const resolved = overrides.some((o: any) => o.exceptionType === type);
          exceptions.push({
            id: `exc-${asg.id}-${type}`,
            assignmentId: asg.id,
            date: dateStr,
            employeeId: emp.id,
            employeeName: emp.name,
            employeeCode: emp.employeeCode || emp.id,
            exceptionType: type,
            severity: "BLOCKED",
            message: `Guard did not clock in for scheduled shift.`,
            siteId: req.siteId,
            siteName: req.site?.name,
            plannedShiftCode: req.shiftCode,
            plannedStartTime: req.shiftStartTime,
            plannedEndTime: req.shiftEndTime,
            resolved,
            overrideReason: resolved ? overrides.find((o: any) => o.exceptionType === type)?.reason : undefined
          });
        } else {
          // C. Late Arrival (> 15 minutes)
          const type = "LATE_ARRIVAL";
          const resolved = overrides.some((o: any) => o.exceptionType === type);

          const plannedStart = parseTime(req.shiftStartTime);
          const checkInTime = new Date(att.checkIn);
          const actualStart = checkInTime.getUTCHours() * 60 + checkInTime.getUTCMinutes();
          const lateMinutes = actualStart - plannedStart;

          if (lateMinutes > 15) {
            exceptions.push({
              id: `exc-${asg.id}-${type}`,
              assignmentId: asg.id,
              date: dateStr,
              employeeId: emp.id,
              employeeName: emp.name,
              employeeCode: emp.employeeCode || emp.id,
              exceptionType: type,
              severity: "WARNING",
              message: `Guard clocked in ${lateMinutes} minutes late.`,
              siteId: req.siteId,
              siteName: req.site?.name,
              plannedShiftCode: req.shiftCode,
              plannedStartTime: req.shiftStartTime,
              plannedEndTime: req.shiftEndTime,
              actualCheckIn: att.checkIn,
              actualCheckOut: att.checkOut,
              resolved,
              overrideReason: resolved ? overrides.find((o: any) => o.exceptionType === type)?.reason : undefined
            });
          }

          // D. Missing Clock-Out
          if (!att.checkOut) {
            const type = "MISSING_CLOCK_OUT";
            const resolved = overrides.some((o: any) => o.exceptionType === type);
            exceptions.push({
              id: `exc-${asg.id}-${type}`,
              assignmentId: asg.id,
              date: dateStr,
              employeeId: emp.id,
              employeeName: emp.name,
              employeeCode: emp.employeeCode || emp.id,
              exceptionType: type,
              severity: "WARNING",
              message: `Guard clocked in but has not clocked out.`,
              siteId: req.siteId,
              siteName: req.site?.name,
              plannedShiftCode: req.shiftCode,
              plannedStartTime: req.shiftStartTime,
              plannedEndTime: req.shiftEndTime,
              actualCheckIn: att.checkIn,
              resolved,
              overrideReason: resolved ? overrides.find((o: any) => o.exceptionType === type)?.reason : undefined
            });
          } else {
            // E. Early Leaving (> 15 minutes)
            const type = "EARLY_LEAVING";
            const resolved = overrides.some((o: any) => o.exceptionType === type);

            const plannedEnd = parseTime(req.shiftEndTime);
            const checkOutTime = new Date(att.checkOut);
            const actualEnd = checkOutTime.getUTCHours() * 60 + checkOutTime.getUTCMinutes();
            const earlyMinutes = plannedEnd - actualEnd;

            if (earlyMinutes > 15) {
              exceptions.push({
                id: `exc-${asg.id}-${type}`,
                assignmentId: asg.id,
                date: dateStr,
                employeeId: emp.id,
                employeeName: emp.name,
                employeeCode: emp.employeeCode || emp.id,
                exceptionType: type,
                severity: "WARNING",
                message: `Guard clocked out ${earlyMinutes} minutes early.`,
                siteId: req.siteId,
                siteName: req.site?.name,
                plannedShiftCode: req.shiftCode,
                plannedStartTime: req.shiftStartTime,
                plannedEndTime: req.shiftEndTime,
                actualCheckIn: att.checkIn,
                actualCheckOut: att.checkOut,
                resolved,
                overrideReason: resolved ? overrides.find((o: any) => o.exceptionType === type)?.reason : undefined
              });
            }
          }

          // F. Off-Site Clock-in
          if (att.lat && att.lng && req.site?.lat && req.site?.lng) {
            const dist = getDistance(att.lat, att.lng, req.site.lat, req.site.lng);
            const radius = req.site.radiusMeters || 100;
            if (dist > radius) {
              const type = "OFF_SITE_CLOCK_IN";
              const resolved = overrides.some((o: any) => o.exceptionType === type);
              exceptions.push({
                id: `exc-${asg.id}-${type}`,
                assignmentId: asg.id,
                date: dateStr,
                employeeId: emp.id,
                employeeName: emp.name,
                employeeCode: emp.employeeCode || emp.id,
                exceptionType: type,
                severity: "BLOCKED",
                message: `Clock-in coordinates outside site boundary (Distance: ${Math.round(dist)}m, Allowed: ${radius}m).`,
                siteId: req.siteId,
                siteName: req.site?.name,
                plannedShiftCode: req.shiftCode,
                plannedStartTime: req.shiftStartTime,
                plannedEndTime: req.shiftEndTime,
                actualCheckIn: att.checkIn,
                resolved,
                overrideReason: resolved ? overrides.find((o: any) => o.exceptionType === type)?.reason : undefined
              });
            }
          }

          // G. Wrong Position / Designation (Acting Duty)
          const reqDesig = req.category?.name || req.categoryId;
          const empDesig = emp.designationName || emp.designationId;
          if (reqDesig && empDesig && reqDesig !== empDesig) {
            const type = "WRONG_POSITION";
            const resolved = overrides.some((o: any) => o.exceptionType === type);
            exceptions.push({
              id: `exc-${asg.id}-${type}`,
              assignmentId: asg.id,
              date: dateStr,
              employeeId: emp.id,
              employeeName: emp.name,
              employeeCode: emp.employeeCode || emp.id,
              exceptionType: type,
              severity: "WARNING",
              message: `Guard worked in different position (Scheduled: ${reqDesig}, Employee Designation: ${empDesig}).`,
              siteId: req.siteId,
              siteName: req.site?.name,
              plannedShiftCode: req.shiftCode,
              plannedStartTime: req.shiftStartTime,
              plannedEndTime: req.shiftEndTime,
              resolved,
              overrideReason: resolved ? overrides.find((o: any) => o.exceptionType === type)?.reason : undefined
            });
          }
        }
      });
    });

    // 2. Process Attendance without planned schedules (Unplanned / Wrong Site)
    attendanceRecords.forEach(att => {
      if (processedEmployeeIds.has(att.employeeId)) return; // already processed scheduled

      const emp = att.employee;
      if (!emp) return;

      const type = "UNPLANNED_SHIFT";
      // To check resolution, we look at local activity log or mock resolution list
      const resolved = (db.resolvedExceptions || []).some((r: any) => r.employeeId === emp.id && r.date === dateStr && r.exceptionType === type);
      const overrideReason = (db.resolvedExceptions || []).find((r: any) => r.employeeId === emp.id && r.date === dateStr && r.exceptionType === type)?.reason;

      exceptions.push({
        id: `exc-unplanned-${att.id}`,
        date: dateStr,
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employeeCode || emp.id,
        exceptionType: type,
        severity: "WARNING",
        message: `Guard clocked in at site ${att.site?.name || ""} without scheduled assignment.`,
        siteId: att.siteId,
        siteName: att.site?.name,
        actualCheckIn: att.checkIn,
        actualCheckOut: att.checkOut,
        resolved,
        overrideReason
      });
    });

    return NextResponse.json({ success: true, date: dateStr, exceptions });

  } catch (error: any) {
    console.error("Failed to compute scheduling exceptions:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage")) {
    return NextResponse.json({ error: "Forbidden: Management rights required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { assignmentId, exceptionType, reason, employeeId, date } = body;

    if (!exceptionType || !reason) {
      return NextResponse.json({ error: "exceptionType and reason are required" }, { status: 400 });
    }

    const resolvedById = (auth.session?.user as any)?.id || "admin";
    const resolvedAt = new Date().toISOString();

    const isDb = isDbConnected();

    if (assignmentId) {
      if (isDb) {
        const asg = await prisma.manpowerDeploymentAssignment.findUnique({
          where: { id: assignmentId }
        });
        if (!asg) {
          return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
        }

        const prevWarnings = typeof asg.validationWarnings === "object" && asg.validationWarnings ? (asg.validationWarnings as any) : {};
        const prevOverrides = prevWarnings.exceptionOverrides || [];

        // Append new override (preserving existing overrides!)
        const updatedOverrides = [
          ...prevOverrides.filter((o: any) => o.exceptionType !== exceptionType),
          {
            exceptionType,
            reason,
            resolvedById,
            resolvedAt
          }
        ];

        await prisma.manpowerDeploymentAssignment.update({
          where: { id: assignmentId },
          data: {
            validationWarnings: {
              ...prevWarnings,
              exceptionOverrides: updatedOverrides
            }
          }
        });
      } else {
        const db = readDb() as any;
        db.manpowerDeploymentAssignments = db.manpowerDeploymentAssignments || [];
        const index = db.manpowerDeploymentAssignments.findIndex((a: any) => a.id === assignmentId);
        if (index === -1) {
          return NextResponse.json({ error: "Assignment not found in memory" }, { status: 404 });
        }

        const asg = db.manpowerDeploymentAssignments[index];
        const prevWarnings = typeof asg.validationWarnings === "object" && asg.validationWarnings ? asg.validationWarnings : {};
        const prevOverrides = prevWarnings.exceptionOverrides || [];

        const updatedOverrides = [
          ...prevOverrides.filter((o: any) => o.exceptionType !== exceptionType),
          {
            exceptionType,
            reason,
            resolvedById,
            resolvedAt
          }
        ];

        db.manpowerDeploymentAssignments[index] = {
          ...asg,
          validationWarnings: {
            ...prevWarnings,
            exceptionOverrides: updatedOverrides
          }
        };
        writeDb(db);
      }
    } else if (employeeId && date) {
      // Unplanned shift resolution stored in mock database list
      const db = readDb() as any;
      db.resolvedExceptions = db.resolvedExceptions || [];
      
      // Remove old matching resolution first
      db.resolvedExceptions = db.resolvedExceptions.filter(
        (r: any) => !(r.employeeId === employeeId && r.date === date && r.exceptionType === exceptionType)
      );

      db.resolvedExceptions.push({
        id: `res-${Date.now()}`,
        employeeId,
        date,
        exceptionType,
        reason,
        resolvedById,
        resolvedAt
      });
      writeDb(db);
    } else {
      return NextResponse.json({ error: "Either assignmentId or employeeId and date are required" }, { status: 400 });
    }

    // Write audit log entry
    await mockDb.createUserActivityLog({
      userId: resolvedById,
      action: "RESOLVE_EXCEPTION",
      entityType: "ManpowerDeploymentAssignment",
      entityId: assignmentId || employeeId || "",
      beforeJson: undefined,
      afterJson: JSON.stringify({ exceptionType, reason, employeeId, date }),
      ipAddress: undefined,
      userAgent: undefined
    });

    return NextResponse.json({ success: true, message: "Exception resolved successfully." });

  } catch (error: any) {
    console.error("Failed to resolve exception:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
