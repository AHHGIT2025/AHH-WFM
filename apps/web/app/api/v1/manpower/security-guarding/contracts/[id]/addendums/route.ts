import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.view") &&
      !hasPermission(auth.session?.user, "commercial.addendum.view") &&
      !hasPermission(auth.session?.user, "commercial.opportunities.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const user = auth.session?.user as any;
    const contract = await mockDb.getManpowerContract(params.id);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if (contract.operationType && contract.operationType !== "SECURITY_GUARDING") {
      return NextResponse.json({ error: "Forbidden: Scope mismatch" }, { status: 403 });
    }
    if (user?.companyId && user?.role !== "SUPER_ADMIN" && (contract as any).companyId && (contract as any).companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation" }, { status: 403 });
    }

    const addendums = await mockDb.getManpowerContractAddendums(params.id);
    return NextResponse.json(addendums);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch contract addendums" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "SECURITY_GUARDING" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.security.manage") &&
      !hasPermission(auth.session?.user, "commercial.addendum.create") &&
      !hasPermission(auth.session?.user, "commercial.addendum.submit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const user = auth.session?.user as any;
    const contract = await mockDb.getManpowerContract(params.id);
    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if (contract.operationType && contract.operationType !== "SECURITY_GUARDING") {
      return NextResponse.json({ error: "Forbidden: Scope mismatch" }, { status: 403 });
    }
    if (user?.companyId && user?.role !== "SUPER_ADMIN" && (contract as any).companyId && (contract as any).companyId !== user.companyId) {
      return NextResponse.json({ error: "Forbidden: Company boundary violation" }, { status: 403 });
    }

    // Business Rule 9 & 11: Addendum is allowed only for ACTIVE contracts.
    if (contract.status !== "ACTIVE") {
      return NextResponse.json({ error: "Addendum can be created only for ACTIVE contracts." }, { status: 400 });
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

    // DEF-081: Every addendum must start as DRAFT, including Admin-created records, requiring workflow approval.
    const addendum = await mockDb.createManpowerContractAddendum({
      ...payload,
      status: "DRAFT",
      contractId: params.id,
      createdBy: user?.id || "unknown"
    });
    return NextResponse.json(addendum);
  } catch (e: any) {
    console.error("ADDENDUM POST ERROR:", e);
    return NextResponse.json({ error: e.message || "Failed to create contract addendum" }, { status: 500 });
  }
}
