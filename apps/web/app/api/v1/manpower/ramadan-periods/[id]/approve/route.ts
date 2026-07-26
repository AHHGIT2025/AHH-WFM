import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.approve" });
  if (auth.error) return auth.error;
  const user = auth.session.user;

  const period = await prisma.manpowerRamadanPeriod.findUnique({
    where: { id: params.id }
  });

  if (!period) {
    return NextResponse.json({ error: "Ramadan period not found" }, { status: 404 });
  }

  if (period.approvalStatus === "APPROVED") {
    return NextResponse.json({ error: "Ramadan period is already approved and immutable" }, { status: 400 });
  }

  // Transactionally ensure only 1 active approved version exists per year
  const updated = await prisma.$transaction(async (tx) => {
    // Supersede any existing approved period for this year
    const existingApproved = await tx.manpowerRamadanPeriod.findMany({
      where: {
        year: period.year,
        approvalStatus: "APPROVED",
        id: { not: period.id }
      }
    });

    for (const exp of existingApproved) {
      await tx.manpowerRamadanPeriod.update({
        where: { id: exp.id },
        data: {
          approvalStatus: "SUPERSEDED",
          supersededAt: new Date()
        }
      });
    }

    return await tx.manpowerRamadanPeriod.update({
      where: { id: period.id },
      data: {
        approvalStatus: "APPROVED",
        approvedById: user.id,
        approvedBy: user.id,
        approvedAt: new Date()
      }
    });
  });

  try {
    await prisma.userActivityLog.create({
      data: {
        userId: user.id,
        action: "APPROVE_RAMADAN_PERIOD",
        entityType: "ManpowerRamadanPeriod",
        entityId: period.id,
        afterJson: JSON.stringify({ year: updated.year, version: updated.version, status: updated.approvalStatus })
      }
    });
  } catch (e) {}

  return NextResponse.json({ success: true, period: updated });
}
