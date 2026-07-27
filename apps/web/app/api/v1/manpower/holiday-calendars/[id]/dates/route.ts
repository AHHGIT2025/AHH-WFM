import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const calendar = await prisma.manpowerHolidayCalendar.findUnique({
    where: { id: params.id },
    include: { dates: true }
  });

  if (!calendar) {
    return NextResponse.json({ success: false, error: "Holiday calendar not found" }, { status: 404 });
  }

  if (calendar.approvalStatus === "APPROVED" || calendar.approvalStatus === "SUPERSEDED") {
    return NextResponse.json({ success: false, error: "Approved or Superseded holiday calendars are immutable" }, { status: 400 });
  }

  let body: any = {};
  try { body = await req.json(); } catch (e) {}

  const {
    holidayDate,
    holidayCode,
    holidayName,
    holidayType,
    operationApplicability,
    rosterOperational,
    payrollAdvisoryTreatment,
    notes
  } = body;

  if (!holidayDate || !holidayName) {
    return NextResponse.json({ success: false, error: "Holiday date and name are required" }, { status: 400 });
  }

  const newDateStr = new Date(holidayDate).toISOString().split("T")[0];

  // Duplicate date validation check inside calendar
  const existingDuplicate = calendar.dates.find((d: any) => {
    const dStr = new Date(d.holidayDate).toISOString().split("T")[0];
    const opMatch = !operationApplicability || d.operationType === operationApplicability || d.operationType === "BOTH" || operationApplicability === "BOTH";
    return dStr === newDateStr && opMatch;
  });

  if (existingDuplicate) {
    return NextResponse.json({
      success: false,
      error: `HOLIDAY_DATE_DUPLICATE: Date ${newDateStr} already exists in this calendar for applicability ${existingDuplicate.operationType}`
    }, { status: 409 });
  }

  try {
    const createdDate = await prisma.manpowerHolidayDate.create({
      data: {
        calendarId: calendar.id,
        holidayDate: new Date(holidayDate),
        holidayCode: holidayCode || `HOL-${Date.now()}`,
        holidayName,
        holidayType: (holidayType || "NATIONAL") as any,
        operationType: operationApplicability || "BOTH",
        rosterOperational: rosterOperational !== undefined ? !!rosterOperational : true,
        payrollAdvisoryTreatment: payrollAdvisoryTreatment || "STANDARD_HOLIDAY",
        approvalStatus: "DRAFT" as any
      }
    });

    return NextResponse.json({ success: true, date: createdDate }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const dateId = searchParams.get("dateId");

  if (!dateId) {
    return NextResponse.json({ success: false, error: "Missing dateId query parameter" }, { status: 400 });
  }

  const calendar = await prisma.manpowerHolidayCalendar.findUnique({
    where: { id: params.id }
  });

  if (!calendar) {
    return NextResponse.json({ success: false, error: "Holiday calendar not found" }, { status: 404 });
  }

  if (calendar.approvalStatus === "APPROVED") {
    return NextResponse.json({ success: false, error: "Approved holiday calendar dates cannot be deleted" }, { status: 400 });
  }

  try {
    await prisma.manpowerHolidayDate.delete({ where: { id: dateId } });
    return NextResponse.json({ success: true, message: "Holiday date deleted" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
