import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import { checkApiAuth } from "@/lib/api-guards";

export async function GET(request: Request) {
  const auth = await checkApiAuth(["ADMIN", "SUPERVISOR", "EMPLOYEE"]);
  if (auth.error) return auth.error;

  try {
    const locations = await prisma.allowedPunchLocation.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" }
    });

    return NextResponse.json(locations);
  } catch (error: any) {
    console.error("Error fetching allowed punch locations:", error);
    return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
  }
}
