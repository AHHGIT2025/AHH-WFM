import { NextResponse } from "next/server";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import { mockDb, readDb, writeDb } from "@ahh-wfm/mock-data";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");

  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }

  try {
    const db = readDb() as any;
    const allowance = (db.siteAllowances || []).find(
      (sa: any) => sa.siteId === siteId && sa.isActive !== false
    );
    return NextResponse.json(allowance || { siteAllowanceEnabled: false });
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
      !hasPermission(auth.session?.user, "security.scheduling.siteAllowance.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    const { siteId, siteAllowanceEnabled, siteAllowanceAmount, siteAllowanceFrequency, allowanceDescription, effectiveFrom, effectiveTo, isActive } = payload;

    if (!siteId) {
      return NextResponse.json({ error: "siteId is required" }, { status: 400 });
    }

    const db = readDb() as any;
    db.siteAllowances = db.siteAllowances || [];

    let record = db.siteAllowances.find((sa: any) => sa.siteId === siteId);

    if (record) {
      Object.assign(record, {
        siteAllowanceEnabled: siteAllowanceEnabled === true,
        siteAllowanceAmount: Number(siteAllowanceAmount || 0),
        siteAllowanceFrequency: siteAllowanceFrequency || "MONTHLY",
        allowanceDescription: allowanceDescription || "",
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        isActive: isActive !== false,
        updatedAt: new Date().toISOString()
      });
    } else {
      record = {
        id: `sa-${Date.now()}`,
        siteId,
        siteAllowanceEnabled: siteAllowanceEnabled === true,
        siteAllowanceAmount: Number(siteAllowanceAmount || 0),
        siteAllowanceFrequency: siteAllowanceFrequency || "MONTHLY",
        allowanceDescription: allowanceDescription || "",
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.siteAllowances.push(record);
    }

    writeDb(db);

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
