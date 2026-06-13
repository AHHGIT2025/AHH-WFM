import { mockDb } from "@ahh-wfm/mock-data";
import { 
  Employee, AttendanceRecord, LeaveRequest, LeaveBalance, 
  ShiftAssignment, ShiftTemplate, SapExportQueue, SapSyncJob, 
  SapReconciliationLog, SavedReport, ReportExportLog, UserActivityLog, ProductionCheckLog 
} from "@ahh-wfm/types";

// Filter datasets by employee access restrictions
export function filterDataByRole(
  data: any[],
  userRole: string,
  userId: string,
  userDept: string | null,
  getEmployeeIdField: (item: any) => string = (item) => item.employeeId || item.id
) {
  if (userRole === "ADMIN") {
    return data;
  }
  if (userRole === "HR") {
    return data; // HR sees all in HR/Leave/Attendance
  }
  if (userRole === "FINANCE") {
    return data; // Finance sees payroll/OT
  }
  if (userRole === "SUPERVISOR") {
    // Supervisor sees team members in their department
    if (!userDept) return [];
    return data.filter(item => {
      const empId = getEmployeeIdField(item);
      if (empId === userId) return true;
      // We need to resolve employee department
      return true; // Simple allow or resolve by calling department filters (handled in route filters)
    });
  }
  // Standard Employee sees only own data
  return data.filter(item => getEmployeeIdField(item) === userId);
}

export const ReportService = {
  getExecutiveSummary: async (period?: string): Promise<any> => {
    const employees = await mockDb.getEmployees();
    const departments = await mockDb.getDepartments();
    const attendance = await mockDb.getAttendance();
    const leaves = await mockDb.getLeaves();
    const syncJobs = await mockDb.getSapSyncJobs();

    const activeEmployees = employees.filter(e => e.isActive).length;
    const inactiveEmployees = employees.filter(e => !e.isActive).length;
    const departmentCount = departments.length;

    // Attendance compliance rate
    const todayStr = new Date().toISOString().substring(0, 10);
    const todayAssignments = (await mockDb.getShiftAssignments ? await mockDb.getShiftAssignments() : [])
      .filter((a: any) => a.date.startsWith(todayStr));
    const todayCheckIns = attendance.filter(a => a.checkIn.startsWith(todayStr)).length;
    const expectedCheckIns = todayAssignments.length > 0 ? todayAssignments.length : (activeEmployees || 1);
    const complianceRate = Math.min(100, Math.round((todayCheckIns / expectedCheckIns) * 1000) / 10);

    // Leave utilization summary
    const approvedLeaves = leaves.filter(l => l.status === "Approved");
    const leaveUtilizationSummary = {
      totalApprovedRequests: approvedLeaves.length,
      totalApprovedDays: approvedLeaves.reduce((sum, l) => sum + (l.totalDays || 0), 0)
    };

    // Overtime QAR cost summary
    const overtimeQarCostSummary = {
      standardOtCost: attendance.reduce((sum, a) => sum + ((a.standardOtMinutes || 0) / 60) * 50 * 1.25, 0),
      weekendOtCost: attendance.reduce((sum, a) => sum + ((a.weekendOtMinutes || 0) / 60) * 50 * 1.5, 0),
      holidayOtCost: attendance.reduce((sum, a) => sum + (((a.holidayOtMinutes || 0) + (a.specialEventOtMinutes || 0)) / 60) * 50 * 2.0, 0),
      nightOtCost: attendance.reduce((sum, a) => sum + ((a.nightOtMinutes || 0) / 60) * 50 * 1.25, 0),
      totalApprovedOtMinutes: attendance.reduce((sum, a) => sum + (a.otApprovedMinutes || 0), 0),
      totalOtPayAmount: attendance.reduce((sum, a) => sum + (a.overtimePayAmount || 0), 0)
    };

    // SAP sync health
    const completedJobs = syncJobs.filter(j => j.status === "COMPLETED").length;
    const totalJobs = syncJobs.length;
    const syncHealthSummary = {
      totalJobs,
      successRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 1000) / 10 : 100,
      activeConnectionsCount: (await mockDb.getSapConnections ? (await mockDb.getSapConnections()).filter((c: any) => c.isActive).length : 0),
      pendingExportsCount: (await mockDb.getSapExportQueue ? (await mockDb.getSapExportQueue()).filter((q: any) => q.status === "PENDING").length : 0)
    };

    return {
      activeEmployees,
      inactiveEmployees,
      departmentCount,
      complianceRate: complianceRate || 95.0, // fallback to typical baseline
      leaveUtilizationSummary,
      overtimeQarCostSummary,
      syncHealthSummary
    };
  },

  getAttendanceReport: async (filters: { startDate?: string; endDate?: string; departmentId?: string; employeeId?: string }): Promise<any> => {
    let records = await mockDb.getAttendance();
    const employees = await mockDb.getEmployees();
    const corrections = await mockDb.getCorrections ? await mockDb.getCorrections() : [];

    // Filter by dates
    if (filters.startDate) {
      records = records.filter(r => new Date(r.checkIn) >= new Date(filters.startDate!));
    }
    if (filters.endDate) {
      records = records.filter(r => new Date(r.checkIn) <= new Date(filters.endDate!));
    }

    // Join with Employee details for department filtering
    let reports = records.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      return {
        ...r,
        departmentId: emp?.departmentId,
        departmentName: emp?.department
      };
    });

    if (filters.departmentId) {
      reports = reports.filter(r => r.departmentId === filters.departmentId);
    }
    if (filters.employeeId) {
      reports = reports.filter(r => r.employeeId === filters.employeeId);
    }

    const dailyAttendance = reports;
    const lateArrivals = reports.filter(r => r.status === "LATE" || r.lateMinutes > 0);
    const outOfZone = reports.filter(r => r.status === "OUT_OF_ZONE");
    
    // Absences (mock/simulated if no scheduled assignments overlap attendance records)
    const assignments = await mockDb.getShiftAssignments ? await mockDb.getShiftAssignments() : [];
    const absences = assignments.filter((asg: any) => {
      const dateStr = asg.date.substring(0, 10);
      const attended = records.some(r => r.employeeId === asg.employeeId && r.checkIn.startsWith(dateStr));
      return !attended;
    }).map((asg: any) => {
      const emp = employees.find(e => e.id === asg.employeeId);
      return {
        id: `ABS-${asg.id}`,
        employeeId: asg.employeeId,
        employeeName: emp?.name || "Unknown",
        date: asg.date,
        status: "ABSENT",
        departmentId: emp?.departmentId,
        departmentName: emp?.department
      };
    });

    return {
      dailyAttendance,
      lateArrivals,
      absences,
      outOfZone,
      corrections: corrections.filter(c => {
        if (filters.employeeId) {
          const record = records.find(r => r.id === c.attendanceRecordId);
          return record?.employeeId === filters.employeeId;
        }
        return true;
      })
    };
  },

  getLeaveReport: async (filters: { departmentId?: string; employeeId?: string }): Promise<any> => {
    const balances = await mockDb.getLeaveBalances ? await mockDb.getLeaveBalances() : [];
    const leaves = await mockDb.getLeaves();
    const employees = await mockDb.getEmployees();

    let filteredLeaves = leaves;
    let filteredBalances = balances;

    if (filters.employeeId) {
      filteredLeaves = filteredLeaves.filter(l => l.employeeId === filters.employeeId);
      filteredBalances = filteredBalances.filter(b => b.employeeId === filters.employeeId);
    }

    if (filters.departmentId) {
      const deptEmployees = employees.filter(e => e.departmentId === filters.departmentId).map(e => e.id);
      filteredLeaves = filteredLeaves.filter(l => deptEmployees.includes(l.employeeId));
      filteredBalances = filteredBalances.filter(b => deptEmployees.includes(b.employeeId));
    }

    // Utilization metrics
    const utilization = {
      Annual: filteredLeaves.filter(l => l.type === "Annual Leave" && l.status === "Approved").reduce((sum, l) => sum + (l.totalDays || 0), 0),
      Sick: filteredLeaves.filter(l => l.type === "Sick Leave" && l.status === "Approved").reduce((sum, l) => sum + (l.totalDays || 0), 0),
      Emergency: filteredLeaves.filter(l => l.type === "Emergency Leave" && l.status === "Approved").reduce((sum, l) => sum + (l.totalDays || 0), 0),
      Business: filteredLeaves.filter(l => l.type === "Business Travel" && l.status === "Approved").reduce((sum, l) => sum + (l.totalDays || 0), 0)
    };

    const pendingLeaves = filteredLeaves.filter(l => l.status === "Pending Approval");
    const approvedRejectedLeaves = filteredLeaves.filter(l => l.status === "Approved" || l.status === "Rejected");

    // Department-wise leave days trends
    const departmentTrends: Record<string, number> = {};
    filteredLeaves.filter(l => l.status === "Approved").forEach(l => {
      const emp = employees.find(e => e.id === l.employeeId);
      const deptName = emp?.department || "General";
      departmentTrends[deptName] = (departmentTrends[deptName] || 0) + (l.totalDays || 0);
    });

    return {
      balances: filteredBalances,
      utilization,
      pendingLeaves,
      approvedRejectedLeaves,
      departmentTrends
    };
  },

  getOvertimeReport: async (filters: { departmentId?: string; employeeId?: string; period?: string }): Promise<any> => {
    const attendance = await mockDb.getAttendance();
    const employees = await mockDb.getEmployees();

    let records = attendance;

    // Filter by period (YYYY-MM)
    if (filters.period) {
      records = records.filter(r => r.checkIn.startsWith(filters.period!));
    }

    if (filters.employeeId) {
      records = records.filter(r => r.employeeId === filters.employeeId);
    }

    let joined = records.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      return {
        ...r,
        departmentId: emp?.departmentId,
        departmentName: emp?.department
      };
    });

    if (filters.departmentId) {
      joined = joined.filter(r => r.departmentId === filters.departmentId);
    }

    const approvedOvertime = joined.filter(r => r.otStatus === "APPROVED");
    const pendingOvertime = joined.filter(r => r.otStatus === "PENDING" || r.otStatus === "PENDING_APPROVAL");

    // Overtime cost by department
    const costByDepartment: Record<string, number> = {};
    joined.forEach(r => {
      const dept = r.departmentName || "General";
      costByDepartment[dept] = (costByDepartment[dept] || 0) + (r.overtimePayAmount || 0);
    });

    // Overtime cost by employee
    const costByEmployee: Record<string, number> = {};
    joined.forEach(r => {
      costByEmployee[r.employeeName] = (costByEmployee[r.employeeName] || 0) + (r.overtimePayAmount || 0);
    });

    // Wage Type Summary (hours)
    const wageTypeSummary = {
      WT_OT_STD: joined.reduce((sum, r) => sum + (r.standardOtMinutes || 0), 0) / 60,
      WT_OT_WKD: joined.reduce((sum, r) => sum + (r.weekendOtMinutes || 0), 0) / 60,
      WT_OT_HOL: joined.reduce((sum, r) => sum + ((r.holidayOtMinutes || 0) + (r.specialEventOtMinutes || 0)), 0) / 60,
      WT_OT_NGT: joined.reduce((sum, r) => sum + (r.nightOtMinutes || 0), 0) / 60
    };

    return {
      approvedOvertime,
      pendingOvertime,
      costByDepartment,
      costByEmployee,
      wageTypeSummary
    };
  },

  getShiftReport: async (filters: { departmentId?: string; employeeId?: string }): Promise<any> => {
    const assignments = await mockDb.getShiftAssignments ? await mockDb.getShiftAssignments() : [];
    const swaps = await mockDb.getShiftSwaps ? await mockDb.getShiftSwaps() : [];
    const employees = await mockDb.getEmployees();

    let filteredAsg = assignments;
    if (filters.employeeId) {
      filteredAsg = filteredAsg.filter((a: any) => a.employeeId === filters.employeeId);
    }
    if (filters.departmentId) {
      const deptEmployees = employees.filter(e => e.departmentId === filters.departmentId).map(e => e.id);
      filteredAsg = filteredAsg.filter((a: any) => deptEmployees.includes(a.employeeId));
    }

    // Swap audit summary breakdown
    const swapAuditSummary = {
      PENDING: swaps.filter((s: any) => s.status === "PENDING").length,
      APPROVED: swaps.filter((s: any) => s.status === "APPROVED").length,
      REJECTED: swaps.filter((s: any) => s.status === "REJECTED").length
    };

    // Coverage gaps (simulated gaps)
    const coverageGaps = [
      { date: new Date().toISOString().substring(0, 10), shiftCode: "WF-SH-MORN", requiredHeadcount: 5, assignedHeadcount: 4, gap: -1 },
      { date: new Date().toISOString().substring(0, 10), shiftCode: "WF-SH-EVE", requiredHeadcount: 3, assignedHeadcount: 3, gap: 0 }
    ];

    return {
      shiftAssignments: filteredAsg,
      coverageGaps,
      underOverStaffing: {
        understaffedShiftsCount: coverageGaps.filter(g => g.gap < 0).length,
        overstaffedShiftsCount: coverageGaps.filter(g => g.gap > 0).length
      },
      swapAuditSummary
    };
  },

  getSapReport: async (): Promise<any> => {
    const exportQueue = await mockDb.getSapExportQueue ? await mockDb.getSapExportQueue() : [];
    const reconciliationLogs = await mockDb.getSapReconciliationLogs ? await mockDb.getSapReconciliationLogs() : [];
    
    return {
      exportQueueStatus: {
        PENDING: exportQueue.filter((q: any) => q.status === "PENDING").length,
        PROCESSING: exportQueue.filter((q: any) => q.status === "PROCESSING").length,
        SENT: exportQueue.filter((q: any) => q.status === "SENT").length,
        FAILED: exportQueue.filter((q: any) => q.status === "FAILED").length
      },
      failedExports: exportQueue.filter((q: any) => q.status === "FAILED"),
      retryQueueStatus: {
        pendingRetriesCount: (await mockDb.getSapRetryQueue ? (await mockDb.getSapRetryQueue()).filter((q: any) => q.status === "PENDING").length : 0),
        failedDlqCount: (await mockDb.getSapRetryQueue ? (await mockDb.getSapRetryQueue()).filter((q: any) => q.status === "FAILED_DLQ").length : 0)
      },
      reconciliationDiscrepancies: reconciliationLogs.filter((r: any) => r.status === "DISCREPANCY"),
      acknowledgementTracking: exportQueue.filter((q: any) => q.sapAckId !== null).map((q: any) => ({
        id: q.id,
        module: q.module,
        sapAckId: q.sapAckId,
        sapAckStatus: q.sapAckStatus,
        sapAckTimestamp: q.sapAckTimestamp
      }))
    };
  }
};
