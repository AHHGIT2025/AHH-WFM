import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view") &&
      !hasPermission(auth.session?.user, "commercial.addendum.view") &&
      !hasPermission(auth.session?.user, "commercial.opportunities.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const addendums = await mockDb.getManpowerContractAddendums(params.id);
    return NextResponse.json(addendums);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch contract addendums" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage") &&
      !hasPermission(auth.session?.user, "commercial.addendum.create") &&
      !hasPermission(auth.session?.user, "commercial.addendum.submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const contract = await mockDb.getManpowerContract(params.id);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (contract.status !== "ACTIVE" && contract.status !== "APPROVED") {
      return NextResponse.json({ error: "Addendum can be created only for active or approved contracts." }, { status: 400 });
    }

    const payload = await request.json();
    if (!payload.title || !payload.addendumType) {
      return NextResponse.json({ error: "Addendum Title and Type are required" }, { status: 400 });
    }

    if (payload.lineItems && Array.isArray(payload.lineItems)) {
      payload.lineItems = payload.lineItems.map((li: any) => ({
        ...li,
        changeType: li.changeType || li.action || "ADD",
        itemName: li.itemName || li.label || ""
      }));
    }

    const isSuperOrAdmin = auth.session?.user?.role === "ADMIN" || auth.session?.user?.role === "SUPER_ADMIN";
    let targetStatus = payload.status || "DRAFT";
    if (targetStatus === "APPROVED" && !isSuperOrAdmin) {
      targetStatus = "DRAFT";
    }

    const addendum = await mockDb.createManpowerContractAddendum({
      ...payload,
      status: targetStatus,
      contractId: params.id,
      createdBy: auth.session?.user?.id || "unknown"
    });
    return NextResponse.json(addendum);
  } catch (e: any) {
    console.error("ADDENDUM POST ERROR:", e);
    return NextResponse.json({ error: e.message || "Failed to create contract addendum" }, { status: 500 });
  }
}
