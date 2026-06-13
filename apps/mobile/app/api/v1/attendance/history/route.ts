import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const records = await prisma.attendanceRecord.findMany({
      where: { employeeId: (session?.user as any)?.id },
      orderBy: { checkIn: "desc" },
      take: 20
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error("GET /attendance/history Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
