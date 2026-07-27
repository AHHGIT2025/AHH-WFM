import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const calendar = await prisma.manpowerHolidayCalendar.findUnique({
    where: { id: params.id },
    include: {
      dates: true,
      company: true,
      supersedesCalendar: true,
      supersededByCalendars: true
    }
  });

  if (!calendar) {
    return NextResponse.json({ success: false, error: "Holiday calendar not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, calendar });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const calendar = await prisma.manpowerHolidayCalendar.findUnique({
    where: { id: params.id },
    include: { dates: true }
  });

  if (!calendar) {
    return NextResponse.json({ success: false, error: "Holiday calendar not found" }, { status: 404 });
  }

  let body: any = {};
  try { body = await req.json(); } catch (e) {}

  const { action } = body;

  if (action === "submit") {
    const updated = await prisma.manpowerHolidayCalendar.update({
      where: { id: params.id },
      data: { approvalStatus: "SUBMITTED" as any }
    });
    return NextResponse.json({ success: true, calendar: updated });
  }

  if (action === "reject") {
    const updated = await prisma.manpowerHolidayCalendar.update({
      where: { id: params.id },
      data: { approvalStatus: "REJECTED" as any }
    });
    return NextResponse.json({ success: true, calendar: updated });
  }

  if (action === "supersede") {
    const nextVersion = calendar.version + 1;
    const { year, name, scope, companyId, effectiveFrom, effectiveTo, notes } = body;

    const newCalendar = await prisma.manpowerHolidayCalendar.create({
      data: {
        year: year != null ? parseInt(year) : calendar.year,
        name: name || `${calendar.name} (V${nextVersion})`,
        scopeKey: calendar.scopeKey,
        scope: scope || calendar.scope,
        companyId: companyId !== undefined ? companyId : calendar.companyId,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : calendar.effectiveFrom,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : calendar.effectiveTo,
        version: nextVersion,
        supersedesCalendarId: calendar.id,
        approvalStatus: "DRAFT" as any,
        notes
      }
    });

    // Copy dates to new draft version
    for (const d of calendar.dates) {
      await prisma.manpowerHolidayDate.create({
        data: {
          calendarId: newCalendar.id,
          holidayDate: d.holidayDate,
          holidayCode: d.holidayCode,
          holidayName: d.holidayName,
          holidayType: d.holidayType,
          operationType: d.operationType,
          rosterOperational: d.rosterOperational,
          payrollAdvisoryTreatment: d.payrollAdvisoryTreatment,
          approvalStatus: "DRAFT" as any
        }
      });
    }

    return NextResponse.json({ success: true, calendar: newCalendar }, { status: 201 });
  }

  if (calendar.approvalStatus === "APPROVED" || calendar.approvalStatus === "SUPERSEDED") {
    return NextResponse.json({ success: false, error: "Approved or Superseded holiday calendars are immutable" }, { status: 400 });
  }

  const { year, code, name, scope, companyId, effectiveFrom, effectiveTo, notes } = body;

  try {
    const updated = await prisma.manpowerHolidayCalendar.update({
      where: { id: params.id },
      data: {
        ...(year != null ? { year: parseInt(year) } : {}),
        ...(code ? { code } : {}),
        ...(name ? { name } : {}),
        ...(scope ? { scope } : {}),
        ...(companyId !== undefined ? { companyId: companyId || null } : {}),
        ...(effectiveFrom ? { effectiveFrom: new Date(effectiveFrom) } : {}),
        ...(effectiveTo !== undefined ? { effectiveTo: effectiveTo ? new Date(effectiveTo) : null } : {}),
        ...(notes !== undefined ? { notes } : {})
      }
    });

    return NextResponse.json({ success: true, calendar: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const calendar = await prisma.manpowerHolidayCalendar.findUnique({
    where: { id: params.id }
  });

  if (!calendar) {
    return NextResponse.json({ success: false, error: "Holiday calendar not found" }, { status: 404 });
  }

  if (calendar.approvalStatus === "APPROVED") {
    return NextResponse.json({ success: false, error: "Approved holiday calendars cannot be deleted" }, { status: 400 });
  }

  try {
    await prisma.manpowerHolidayCalendar.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true, message: "Holiday calendar deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
