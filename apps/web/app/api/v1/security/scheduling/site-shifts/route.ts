import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, isDbConnected, readDb, writeDb } from "@ahh-wfm/mock-data";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");

  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }

  try {
    const isDb = isDbConnected();
    let requirements: any[] = [];
    
    if (isDb) {
      requirements = await prisma.manpowerShiftRequirement.findMany({
        where: { siteId, operationType: "SECURITY_GUARDING" },
        include: { category: true }
      });
    } else {
      const db = readDb() as any;
      const allReqs = db.shiftRequirements || [];
      const cats = db.manpowerCategories || [];
      requirements = allReqs
        .filter((r: any) => r.siteId === siteId && r.operationType === "SECURITY_GUARDING")
        .map((r: any) => ({
          ...r,
          category: cats.find((c: any) => c.id === r.categoryId) || null
        }));
    }
    return NextResponse.json(requirements);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const isSuperOrAdmin = auth.session?.user && (auth.session.user.role === "ADMIN" || auth.session.user.role === "SUPER_ADMIN");
  if (!isSuperOrAdmin && 
      !hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage") &&
      !hasPermission(auth.session?.user, "security.scheduling.siteShift.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { id, siteId, categoryId, shiftCode, requiredCount, shiftStartTime, shiftEndTime, isActive } = payload;

    if (!siteId || !categoryId || !shiftCode || requiredCount === undefined) {
      return NextResponse.json({ error: "siteId, categoryId, shiftCode, and requiredCount are required" }, { status: 400 });
    }

    const isDb = isDbConnected();
    let record: any = null;

    if (isDb) {
      if (id) {
        record = await prisma.manpowerShiftRequirement.update({
          where: { id },
          data: {
            categoryId,
            shiftCode,
            requiredCount: Number(requiredCount),
            shiftStartTime,
            shiftEndTime,
            isActive: isActive !== false
          }
        });
      } else {
        record = await prisma.manpowerShiftRequirement.create({
          data: {
            siteId,
            categoryId,
            shiftCode,
            requiredCount: Number(requiredCount),
            shiftStartTime,
            shiftEndTime,
            operationType: "SECURITY_GUARDING",
            isActive: true
          }
        });
      }
    } else {
      const db = readDb() as any;
      db.shiftRequirements = db.shiftRequirements || [];

      if (id) {
        const idx = db.shiftRequirements.findIndex((r: any) => r.id === id);
        if (idx !== -1) {
          db.shiftRequirements[idx] = {
            ...db.shiftRequirements[idx],
            categoryId,
            shiftCode,
            requiredCount: Number(requiredCount),
            shiftStartTime,
            shiftEndTime,
            isActive: isActive !== false,
            updatedAt: new Date().toISOString()
          };
          record = db.shiftRequirements[idx];
        } else {
          return NextResponse.json({ error: "Shift requirement not found" }, { status: 404 });
        }
      } else {
        record = {
          id: `sr-${Date.now()}`,
          siteId,
          categoryId,
          shiftCode,
          requiredCount: Number(requiredCount),
          shiftStartTime,
          shiftEndTime,
          operationType: "SECURITY_GUARDING",
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.shiftRequirements.push(record);
      }
      writeDb(db);
    }

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
