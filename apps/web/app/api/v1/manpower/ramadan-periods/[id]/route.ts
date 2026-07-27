import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const period = await prisma.manpowerRamadanPeriod.findUnique({
    where: { id: params.id },
    include: {
      supersedesPeriod: true,
      supersededByPeriods: true
    }
  });

  if (!period) {
    return NextResponse.json({ success: false, error: "Ramadan period not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, period });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const period = await prisma.manpowerRamadanPeriod.findUnique({
    where: { id: params.id }
  });

  if (!period) {
    return NextResponse.json({ success: false, error: "Ramadan period not found" }, { status: 404 });
  }

  let body: any = {};
  try { body = await req.json(); } catch (e) {}

  const { action } = body;

  if (action === "submit") {
    const updated = await prisma.manpowerRamadanPeriod.update({
      where: { id: params.id },
      data: { approvalStatus: "SUBMITTED" as any }
    });
    return NextResponse.json({ success: true, period: updated });
  }

  if (action === "reject") {
    const updated = await prisma.manpowerRamadanPeriod.update({
      where: { id: params.id },
      data: { approvalStatus: "REJECTED" as any }
    });
    return NextResponse.json({ success: true, period: updated });
  }

  if (action === "supersede") {
    const nextVersion = period.version + 1;
    const { year, name, startDate, endDate, notes } = body;

    const newPeriod = await prisma.manpowerRamadanPeriod.create({
      data: {
        year: year != null ? parseInt(year) : period.year,
        name: name || `${period.name} (V${nextVersion})`,
        startDate: startDate ? new Date(startDate) : period.startDate,
        endDate: endDate ? new Date(endDate) : period.endDate,
        version: nextVersion,
        supersedesPeriodId: period.id,
        approvalStatus: "DRAFT" as any,
        notes
      }
    });

    return NextResponse.json({ success: true, period: newPeriod }, { status: 201 });
  }

  if (period.approvalStatus === "APPROVED" || period.approvalStatus === "SUPERSEDED") {
    return NextResponse.json({ success: false, error: "Approved or Superseded Ramadan periods are immutable" }, { status: 400 });
  }

  const { year, name, startDate, endDate, notes } = body;

  try {
    const updated = await prisma.manpowerRamadanPeriod.update({
      where: { id: params.id },
      data: {
        ...(year != null ? { year: parseInt(year) } : {}),
        ...(name ? { name } : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate ? { endDate: new Date(endDate) } : {}),
        ...(notes !== undefined ? { notes } : {})
      }
    });

    return NextResponse.json({ success: true, period: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const period = await prisma.manpowerRamadanPeriod.findUnique({
    where: { id: params.id }
  });

  if (!period) {
    return NextResponse.json({ success: false, error: "Ramadan period not found" }, { status: 404 });
  }

  if (period.approvalStatus === "APPROVED") {
    return NextResponse.json({ success: false, error: "Approved Ramadan periods cannot be deleted" }, { status: 400 });
  }

  try {
    await prisma.manpowerRamadanPeriod.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: "Ramadan period deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
