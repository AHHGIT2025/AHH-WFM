import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "../../../../../../lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const business = searchParams.get("business");

  if (!business) {
    return NextResponse.json({ error: "Missing business query parameter" }, { status: 400 });
  }

  const operationType = business === "security-guarding" ? "SECURITY_GUARDING" : "FACILITY_MANAGEMENT";

  try {
    const clients = await prisma.manpowerClient.findMany({
      where: { operationType },
      orderBy: { name: "asc" }
    });

    const contracts = await prisma.manpowerContract.findMany({
      where: { operationType },
      orderBy: { contractNumber: "asc" }
    });

    const projects = await prisma.manpowerProject.findMany({
      where: { operationType },
      orderBy: { name: "asc" }
    });

    const sites = await prisma.manpowerSite.findMany({
      where: { operationType },
      orderBy: { name: "asc" }
    });

    return NextResponse.json({
      success: true,
      clients,
      contracts,
      projects,
      sites
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to load filters" }, { status: 500 });
  }
}
