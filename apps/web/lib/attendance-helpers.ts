import { prisma } from "@ahh-wfm/database";
import { getQatarDate, getQatarDateString } from "@/lib/roster-engine";

export interface AttendancePulseParams {
  companyId?: string;
  operationType?: string;
  businessDateStr?: string;
}

export interface AttendancePulseResult {
  businessDate: string;
  targetDateStart: Date;
  targetDateEnd: Date;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  missingPunch: number;
  leavesToday: number;
  unresolvedCorrections: number;
}

export async function getAttendancePulseAggregations(
  params: AttendancePulseParams
): Promise<AttendancePulseResult> {
  const { companyId, operationType, businessDateStr: rawDateStr } = params;

  const businessDate = rawDateStr ? rawDateStr.trim() : getQatarDateString(new Date());
  const targetDate = getQatarDate(businessDate);
  const targetDateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
  const targetDateEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

  const empWhere: any = {};
  if (companyId) empWhere.companyId = companyId;
  if (operationType && operationType !== "ALL") empWhere.operationType = operationType;

  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: {
      checkIn: {
        gte: targetDateStart,
        lte: targetDateEnd
      },
      ...(companyId ? { companyId } : {})
    },
    select: {
      id: true,
      employeeId: true,
      status: true,
      lateMinutes: true,
      checkIn: true,
      checkOut: true
    }
  });

  const presentToday = attendanceRecords.filter(
    (a) => a.status === "ON_TIME" || a.status === "CORRECTED" || a.checkIn !== null
  ).length;
  const absentToday = attendanceRecords.filter((a) => a.status === "ABSENT").length;
  const lateToday = attendanceRecords.filter((a) => a.status === "LATE" || (a.lateMinutes && a.lateMinutes > 0)).length;
  const missingPunch = attendanceRecords.filter((a) => a.checkIn !== null && a.checkOut === null).length;

  const leavesToday = await prisma.leaveRequest.count({
    where: {
      status: "APPROVED",
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
      employee: empWhere
    }
  });

  const unresolvedCorrections = await prisma.attendanceCorrection.count({
    where: {
      status: "Pending"
    }
  });

  return {
    businessDate,
    targetDateStart,
    targetDateEnd,
    presentToday,
    absentToday,
    lateToday,
    missingPunch,
    leavesToday,
    unresolvedCorrections
  };
}
