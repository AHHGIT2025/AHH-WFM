import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../../lib/auth";
import { prisma } from "@ahh-wfm/database";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    // Find today's open attendance record
    const existingRecords = await prisma.attendanceRecord.findMany({
        where: {
            employeeId: (session?.user as any)?.id,
            checkIn: {
                gte: startOfDay,
                lte: endOfDay
            },
            checkOut: null
        },
        orderBy: { checkIn: "desc" }
    });

    if (existingRecords.length === 0) {
        return NextResponse.json({ error: "No open check-in found for today" }, { status: 400 });
    }

    const recordToUpdate = existingRecords[0];

    const updated = await prisma.attendanceRecord.update({
        where: { id: recordToUpdate.id },
        data: {
            checkOut: now,
            originalCheckOut: now
        }
    });

    return NextResponse.json({
        success: true,
        record: updated,
    });

  } catch (error) {
    console.error("POST /attendance/check-out Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
