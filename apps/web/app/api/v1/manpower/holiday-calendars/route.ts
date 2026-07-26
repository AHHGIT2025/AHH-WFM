import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { prisma } from "@ahh-wfm/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;
  const scope = searchParams.get("scope") || undefined;

  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const calendars = await prisma.manpowerHolidayCalendar.findMany({
    where: {
      ...(year ? { year } : {}),
      ...(scope ? { scope: scope as any } : {})
    },
    include: { dates: true },
    orderBy: { year: "desc" }
  });

  return NextResponse.json({ success: true, calendars });
}

export async function POST(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  let body: any = {};
  try { body = await request.json(); } catch (e) {}

  const { year, name, scope, dates, approvalStatus, companyId, notes } = body;
  const userId = auth.session?.user?.id || "AD-0001";

  if (!year || !name) {
    return NextResponse.json({ success: false, error: "Missing required fields (year, name)" }, { status: 400 });
  }

  const holidayScope = scope || "BOTH";
  const targetStatus = approvalStatus || "DRAFT";

  try {
    const calendar = await prisma.manpowerHolidayCalendar.create({
      data: {
        year: parseInt(year),
        name,
        scope: holidayScope,
        approvalStatus: targetStatus,
        approvedBy: targetStatus === "APPROVED" ? userId : null,
        approvedAt: targetStatus === "APPROVED" ? new Date() : null,
        companyId: companyId || null,
        notes,
        dates: {
          create: Array.isArray(dates) ? dates.map((d: any) => ({
            holidayDate: new Date(d.holidayDate),
            holidayCode: d.holidayCode || `HOL-${d.holidayDate}`,
            holidayName: d.holidayName,
            holidayType: d.holidayType || "NATIONAL",
            operationType: d.operationType || "BOTH",
            rosterOperational: d.rosterOperational !== false,
            payrollAdvisoryTreatment: d.payrollAdvisoryTreatment || "PUBLIC_HOLIDAY_WORKED",
            approvalStatus: d.approvalStatus || "APPROVED"
          })) : []
        }
      },
      include: { dates: true }
    });

    return NextResponse.json({ success: true, calendar }, { status: 201 });
  } catch (error: any) {
    console.error("Failed to create Holiday Calendar:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
