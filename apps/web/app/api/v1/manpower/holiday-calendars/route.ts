import { NextResponse } from "next/server";
import { checkApiAuth, canAccessCompany } from "@/lib/api-guards";
import { hasPermission, isAdminUser } from "@/lib/permissions";
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
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.manage" });
  if (auth.error) return auth.error;

  const user = auth.session?.user;
  let body: any = {};
  try { body = await request.json(); } catch (e) {}

  const { year, name, scope, dates, approvalStatus, companyId, notes } = body;
  const userId = user?.id || "AD-0001";

  if (!year || !name) {
    return NextResponse.json({ success: false, error: "Missing required fields (year, name)" }, { status: 400 });
  }

  if (companyId && !canAccessCompany(user, companyId)) {
    return NextResponse.json({ success: false, error: "Forbidden: Cross-company access denied" }, { status: 403 });
  }

  const holidayScope = scope || "BOTH";
  const targetStatus = approvalStatus || "DRAFT";

  if (targetStatus === "APPROVED" && !isAdminUser(user) && !hasPermission(user, "manpower.calendars.approve")) {
    return NextResponse.json(
      { success: false, error: "Forbidden: Missing permission manpower.calendars.approve to create pre-approved calendar" },
      { status: 403 }
    );
  }

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
