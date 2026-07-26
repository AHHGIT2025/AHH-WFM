import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(req: NextRequest) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.advisory.view" });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get("year");

  const periods = await prisma.manpowerRamadanPeriod.findMany({
    where: yearStr ? { year: parseInt(yearStr) } : {},
    orderBy: [{ year: "desc" }, { version: "desc" }]
  });

  return NextResponse.json({ periods });
}

export async function POST(req: NextRequest) {
  const auth = await checkApiAuth(undefined, { requiredPermission: "manpower.calendars.manage" });
  if (auth.error) return auth.error;
  const user = auth.session.user;

  const body = await req.json();
  const { year, name, startDate, endDate, supersedesPeriodId } = body;

  if (!year || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields (year, startDate, endDate)" }, { status: 400 });
  }

  let version = 1;
  if (supersedesPeriodId) {
    const prior = await prisma.manpowerRamadanPeriod.findUnique({ where: { id: supersedesPeriodId } });
    if (prior) version = prior.version + 1;
  } else {
    const latest = await prisma.manpowerRamadanPeriod.findFirst({
      where: { year: parseInt(year) },
      orderBy: { version: "desc" }
    });
    if (latest) version = latest.version + 1;
  }

  const period = await prisma.manpowerRamadanPeriod.create({
    data: {
      year: parseInt(year),
      name: name || `Ramadan ${year} v${version}`,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      version,
      supersedesPeriodId: supersedesPeriodId || null,
      createdById: user.id,
      approvalStatus: "DRAFT"
    }
  });

  try {
    await prisma.userActivityLog.create({
      data: {
        userId: user.id,
        action: "CREATE_RAMADAN_PERIOD",
        entityType: "ManpowerRamadanPeriod",
        entityId: period.id,
        afterJson: JSON.stringify({ year: period.year, version: period.version, status: period.approvalStatus })
      }
    });
  } catch (e) {}

  return NextResponse.json({ success: true, period }, { status: 201 });
}
