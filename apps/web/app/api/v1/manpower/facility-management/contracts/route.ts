import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";
import { hasPermission } from "@/lib/permissions";
import {
  checkContractCompanyAccess,
  resolveAndValidateContractCompany,
  resolveContractListCompanyFilter,
} from "@/lib/contract-company-auth";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "FACILITY_MANAGEMENT" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const companyFilter = resolveContractListCompanyFilter(
    auth.session?.user,
    searchParams.get("companyId")
  );
  if (companyFilter.error) return companyFilter.error;

  try {
    const contracts = await mockDb.getManpowerContracts(
      "FACILITY_MANAGEMENT",
      companyFilter.canCrossCompany
        ? (companyFilter.companyId ? { companyId: companyFilter.companyId } : undefined)
        : {
            companyId: companyFilter.companyId,
            companyIds: companyFilter.allowedCompanyIds,
          }
    );
    return NextResponse.json(contracts);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch contracts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "FACILITY_MANAGEMENT" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.clientId || !payload.contractNumber || !payload.title || !payload.startDate || !payload.endDate) {
      return NextResponse.json({ error: "Client, Contract Number, Title, Start Date, and End Date are required" }, { status: 400 });
    }
    const companyAuth = await resolveAndValidateContractCompany(auth.session?.user, {
      companyId: payload.companyId,
      clientId: payload.clientId,
      projectId: payload.projectId,
    });
    if (companyAuth.error) return companyAuth.error;

    const contract = await mockDb.createManpowerContract({
      ...payload,
      companyId: companyAuth.companyId,
      operationType: "FACILITY_MANAGEMENT"
    });
    return NextResponse.json(contract);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Contract save failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await checkApiAuth(undefined, { requiredOperation: "FACILITY_MANAGEMENT" });
  if (auth.error) return auth.error;

  if (!hasPermission(auth.session?.user, "manpower.admin.full_access") &&
      !hasPermission(auth.session?.user, "manpower.fm.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = await request.json();
    if (!payload.id) {
      return NextResponse.json({ error: "Contract ID is required" }, { status: 400 });
    }
    const existing = await mockDb.getManpowerContract(payload.id);
    if (!existing) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }
    if (existing.operationType && existing.operationType !== "FACILITY_MANAGEMENT") {
      return NextResponse.json({ error: "Forbidden: Contract belongs to a different operation scope" }, { status: 403 });
    }
    const companyErr = checkContractCompanyAccess(auth.session?.user, existing, {
      requireVerifiedOwnership: true,
    });
    if (companyErr) return companyErr;

    const { companyId: _ignoredCompanyId, ...safePayload } = payload;
    const contract = await mockDb.updateManpowerContract(payload.id, safePayload);
    return NextResponse.json(contract);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Contract save failed", details: String(error) },
      { status: 500 }
    );
  }
}
