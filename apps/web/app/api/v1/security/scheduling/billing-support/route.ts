import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || new Date().toISOString().substring(0, 7); // YYYY-MM
  const clientId = searchParams.get("clientId") || "all";

  try {
    const isDb = isDbConnected();
    const db = readDb() as any;

    let deployments: any[] = [];
    let attendanceRecords: any[] = [];
    let clients: any[] = [];
    let contracts: any[] = [];
    let projects: any[] = [];
    let sites: any[] = [];
    let shiftRequirements: any[] = [];

    if (isDb) {
      const year = parseInt(period.split("-")[0]);
      const month = parseInt(period.split("-")[1]);
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59, 999);

      deployments = await prisma.manpowerDeployment.findMany({
        where: {
          date: { gte: start, lte: end },
          operationType: "SECURITY_GUARDING"
        },
        include: {
          assignments: {
            include: {
              employee: true
            }
          },
          shiftRequirement: {
            include: {
              category: true,
              site: {
                include: {
                  project: {
                    include: {
                      contract: {
                        include: {
                          client: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      attendanceRecords = await prisma.attendanceRecord.findMany({
        where: {
          checkIn: { gte: start, lte: end },
          employee: {
            operationType: "SECURITY_GUARDING"
          }
        }
      });
    } else {
      const employees = db.employees || [];
      const rawClients = db.manpowerClients || [];
      const rawContracts = db.manpowerContracts || [];
      const rawProjects = db.manpowerProjects || [];
      const rawSites = db.manpowerSites || [];
      const rawShifts = db.shiftRequirements || [];
      const rawCats = db.manpowerCategories || [];

      clients = rawClients.filter((c: any) => c.operationType === "SECURITY_GUARDING");
      contracts = rawContracts.filter((c: any) => c.operationType === "SECURITY_GUARDING").map((c: any) => ({
        ...c,
        client: clients.find((cl: any) => cl.id === c.clientId) || null
      }));
      projects = rawProjects.filter((p: any) => p.operationType === "SECURITY_GUARDING").map((p: any) => ({
        ...p,
        contract: contracts.find((c: any) => c.id === p.contractId) || null
      }));
      sites = rawSites.filter((s: any) => s.operationType === "SECURITY_GUARDING").map((s: any) => ({
        ...s,
        project: projects.find((p: any) => p.id === s.projectId) || null
      }));

      shiftRequirements = rawShifts.filter((r: any) => r.operationType === "SECURITY_GUARDING").map((r: any) => ({
        ...r,
        site: sites.find((s: any) => s.id === r.siteId) || null,
        category: rawCats.find((c: any) => c.id === r.categoryId) || null
      }));

      deployments = (db.manpowerDeployments || []).filter((d: any) => {
        const dStr = String(d.date).substring(0, 7);
        return dStr === period && d.operationType === "SECURITY_GUARDING";
      }).map((d: any) => {
        const req = shiftRequirements.find((r: any) => r.id === d.shiftRequirementId);
        const asgs = (db.manpowerDeploymentAssignments || []).filter((a: any) => a.deploymentId === d.id).map((a: any) => {
          const emp = employees.find((e: any) => e.id === a.employeeId);
          return {
            ...a,
            employee: emp || null
          };
        });
        return {
          ...d,
          shiftRequirement: req,
          assignments: asgs
        };
      });

      attendanceRecords = (db.attendance || []).filter((a: any) => {
        const aDate = String(a.checkIn || "").substring(0, 7);
        if (aDate !== period) return false;
        const emp = employees.find((e: any) => e.id === a.employeeId);
        return emp && emp.operationType === "SECURITY_GUARDING";
      });
    }

    // Process and aggregate billing lines
    const billingLines: any[] = [];

    deployments.forEach(dep => {
      const req = dep.shiftRequirement;
      if (!req) return;

      const site = req.site;
      const project = site?.project;
      const contract = project?.contract;
      const client = contract?.client;

      if (!client) return;
      if (clientId !== "all" && client.id !== clientId) return;

      const dateStr = String(dep.date).split("T")[0];
      let plannedManpower = req.requiredCount || 0;
      let actualManpower = 0;
      let actualHours = 0;
      let relieversUsed = 0;

      (dep.assignments || []).forEach((asg: any) => {
        actualManpower++;
        if (asg.isReliever) relieversUsed++;

        const att = attendanceRecords.find(a => a.employeeId === asg.employeeId && String(a.checkIn).split("T")[0] === dateStr);
        if (att && att.checkIn && att.checkOut) {
          actualHours += Math.round((new Date(att.checkOut).getTime() - new Date(att.checkIn).getTime()) / (1000 * 60 * 60) * 10) / 10;
        } else if (att) {
          actualHours += 12; // default shift length fallback
        }
      });

      // Billable quantity advisory: count present scheduled guards.
      // Under-deployment doesn't charge client, over-deployment might not be billable unless approved.
      const billableAdvisoryQty = Math.min(plannedManpower, actualManpower);

      billingLines.push({
        id: `bill-${dep.id}`,
        date: dateStr,
        clientName: client.name || client.clientName || "Unnamed Client",
        contractCode: contract.contractNumber || contract.id,
        projectName: project.name || project.projectName || "Unnamed Project",
        siteName: site.name || "Unnamed Site",
        position: req.category?.name || req.categoryId || "Security Guard",
        plannedManpower,
        actualManpower,
        actualHours: Math.round(actualHours * 10) / 10,
        relieversUsed,
        billableAdvisoryQty,
        comments: actualManpower < plannedManpower ? "Under-deployment penalty may apply" : "Full deployment delivered"
      });
    });

    return NextResponse.json({
      success: true,
      period,
      billingLines
    });

  } catch (error: any) {
    console.error("Failed to generate billing support data:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
