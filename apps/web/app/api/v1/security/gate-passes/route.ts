import { NextResponse } from "next/server";
import { mockDb } from "@ahh-wfm/mock-data";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId") || undefined;
  const siteId = searchParams.get("siteId") || undefined;

  try {
    const list = await mockDb.getSecurityGatePasses(employeeId, siteId);
    return NextResponse.json(list);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to fetch security gate passes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await checkApiAuth(undefined, {
    requiredOperation: "SECURITY_GUARDING"
  });
  if (auth.error) return auth.error;

  try {
    const data = await request.json();
    if (!data.employeeId || !data.siteId || !data.issueDate || !data.expiryDate) {
      return NextResponse.json({ error: "Missing required fields (employeeId, siteId, issueDate, expiryDate)" }, { status: 400 });
    }
    const created = await mockDb.createSecurityGatePass(data);
    return NextResponse.json(created);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to create security gate pass" }, { status: 500 });
  }
}
