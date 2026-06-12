import { Employee, AttendanceRecord, Shift, LeaveRequest, SapMapping, SyncLog, Announcement, Department, Worksite, AttendanceCorrection, LeaveType, LeaveBalance, LeaveBalanceLedger, Holiday, LeaveApprovalWorkflow, LeaveApprovalStep, LeaveApprovalHistory, LeaveApprovalDelegation, ShiftTemplate, RotationTemplate, ShiftAssignment, ShiftSwapRequest, OvertimeRate, SapConnection, SapSyncJob, SapSyncLog, SapFieldMapping, SapRetryQueue } from "@ahh-wfm/types";
import * as fs from "fs";
import * as path from "path";
import * as bcrypt from "bcryptjs";

// Generate default hash for mock passwords during local development
const defaultHash = bcrypt.hashSync("Password123!", 10);

// Initialize Prisma dynamically if DATABASE_URL is available
let prismaClient: any = null;
const isDbConnected = () => {
  if (typeof window !== "undefined") return false;
  if (!process.env.DATABASE_URL) return false;
  
  if (!prismaClient) {
    try {
      const { prisma } = require("@ahh-wfm/database");
      prismaClient = prisma;
    } catch (e) {
      console.error("Failed to load @ahh-wfm/database package", e);
    }
  }
  return !!prismaClient;
};

// Helper utilities for Leave Calculations
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6; // Friday and Saturday (Qatar)
}

function parseDateRange(dateRange: string): { start: Date; end: Date } {
  try {
    const parts = dateRange.split(/—|-|to/);
    if (parts.length === 2) {
      let startStr = parts[0].trim();
      let endStr = parts[1].trim();
      
      const yearMatch = endStr.match(/\d{4}/);
      if (yearMatch && !startStr.match(/\d{4}/)) {
        startStr += ` ${yearMatch[0]}`;
      }
      
      const start = new Date(startStr);
      const end = new Date(endStr);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        return { start, end };
      }
    }
  } catch (e) {}
  const now = new Date();
  return { start: now, end: now };
}

// In-memory fallback dataset (also used to seed MySQL)
let memoryDb: {
  employees: Employee[];
  attendance: AttendanceRecord[];
  shifts: Shift[];
  leaves: LeaveRequest[];
  sapMappings: SapMapping[];
  syncLogs: SyncLog[];
  announcements: Announcement[];
  departments: Department[];
  worksites: Worksite[];
  attendanceCorrections: AttendanceCorrection[];
  leaveTypes: LeaveType[];
  leaveBalances: LeaveBalance[];
  leaveBalanceLedgers: LeaveBalanceLedger[];
  holidays: Holiday[];
  leaveApprovalWorkflows: LeaveApprovalWorkflow[];
  leaveApprovalSteps: LeaveApprovalStep[];
  leaveApprovalHistories: LeaveApprovalHistory[];
  leaveApprovalDelegations: LeaveApprovalDelegation[];
  shiftTemplates: ShiftTemplate[];
  rotationTemplates: RotationTemplate[];
  shiftAssignments: ShiftAssignment[];
  shiftSwaps: ShiftSwapRequest[];
  overtimeRates: OvertimeRate[];
  sapConnections: SapConnection[];
  sapSyncJobs: SapSyncJob[];
  sapSyncLogs: SapSyncLog[];
  sapFieldMappings: SapFieldMapping[];
  sapRetryQueues: SapRetryQueue[];
} = {
  departments: [
    { id: "DEPT-001", name: "Operations", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "DEPT-002", name: "Engineering", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "DEPT-003", name: "Logistics", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "DEPT-004", name: "Sales", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: "DEPT-005", name: "IT", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ],
  employees: [
    { id: "SK-90210", name: "Sarah Kim", department: "Operations", departmentId: "DEPT-001", role: "SUPERVISOR", status: "On Break", email: "sarah.kim@alhattab.qa", phone: "+974 5555 1234", shiftId: "MOR-102", passwordHash: defaultHash, isActive: true },
    { id: "AM-8821", name: "Alex Martinez", department: "Engineering", departmentId: "DEPT-002", role: "EMPLOYEE", status: "On Duty", email: "alex.m@alhattab.qa", phone: "+974 5555 5678", shiftId: "GEN-001", passwordHash: defaultHash, isActive: true },
    { id: "BR-8823", name: "Brandon Reed", department: "Logistics", departmentId: "DEPT-003", role: "EMPLOYEE", status: "On Duty", email: "brandon.r@alhattab.qa", phone: "+974 5555 9012", shiftId: "AFT-103", passwordHash: defaultHash, isActive: true },
    { id: "JL-8824", name: "Jordan Lee", department: "Sales", departmentId: "DEPT-004", role: "EMPLOYEE", status: "Offline", email: "jordan.lee@alhattab.qa", phone: "+974 5555 3456", shiftId: "ROT-A", passwordHash: defaultHash, isActive: true },
    { id: "AA-1001", name: "Ahmed Ali", department: "Operations", departmentId: "DEPT-001", role: "EMPLOYEE", status: "Offline", email: "ahmed.ali@alhattab.qa", phone: "+974 6666 1111", shiftId: "GEN-001", passwordHash: defaultHash, isActive: true },
    { id: "AD-0001", name: "System Administrator", department: "IT", departmentId: "DEPT-005", role: "ADMIN", status: "Offline", email: "admin@alhattab.qa", phone: "+974 0000 0000", shiftId: "GEN-001", passwordHash: defaultHash, isActive: true }
  ],
  attendance: [
    { id: "ATT-001", employeeId: "AM-8821", employeeName: "Alex Martinez", checkIn: "2026-06-11T08:55:00Z", checkOut: "2026-06-11T18:02:00Z", originalCheckIn: "2026-06-11T08:55:00Z", originalCheckOut: "2026-06-11T18:02:00Z", lat: 25.2854, lng: 51.5310, device: "Galaxy S23 · 5G · GPS Active", status: "ON_TIME", locationName: "Doha Headquarters", lateMinutes: 0 },
    { id: "ATT-002", employeeId: "SK-90210", employeeName: "Sarah Kim", checkIn: "2026-06-11T09:15:00Z", originalCheckIn: "2026-06-11T09:15:00Z", lat: 25.2867, lng: 51.5325, device: "iPhone 15 Pro · Wi-Fi", status: "LATE", locationName: "West Bay Office", lateMinutes: 15 },
    { id: "ATT-003", employeeId: "BR-8823", employeeName: "Brandon Reed", checkIn: "2026-06-11T13:58:00Z", originalCheckIn: "2026-06-11T13:58:00Z", lat: 25.2905, lng: 51.5201, device: "iPad Mini · 4G LTE", status: "ON_TIME", locationName: "Industrial Area Depot", lateMinutes: 0 }
  ],
  shifts: [
    { id: "GEN-001", name: "General Shift", code: "GEN-001", timeRange: "09:00 AM — 06:00 PM", breakDuration: "60 mins", status: "Active" },
    { id: "MOR-102", name: "Morning Shift", code: "MOR-102", timeRange: "06:00 AM — 02:00 PM", breakDuration: "45 mins", status: "Active" },
    { id: "AFT-103", name: "Afternoon Shift", code: "AFT-103", timeRange: "02:00 PM — 10:00 PM", breakDuration: "45 mins", status: "Active" },
    { id: "NGT-201", name: "Night Shift", code: "NGT-201", timeRange: "10:00 PM — 06:00 AM", breakDuration: "30 mins", status: "Active" },
    { id: "ROT-A", name: "Rotational A", code: "ROT-A", timeRange: "Variable", breakDuration: "Flexible", status: "Inactive" }
  ],
  leaves: [
    { id: "LV-001", employeeId: "SK-90210", employeeName: "Sarah Kim", type: "Annual Leave", dateRange: "25 Jun - 28 Jun 2026", reason: "Family trip to Dubai", status: "Pending Approval" },
    { id: "LV-002", employeeId: "AM-8821", employeeName: "Alex Martinez", type: "Sick Leave", dateRange: "14 Jun - 15 Jun 2026", reason: "Medical Appointment", status: "Approved" }
  ],
  sapMappings: [
    { id: "MAP-001", sourceField: "userId", targetField: "employeeId", transformationRule: "Direct string mapping", status: "Mapped" },
    { id: "MAP-002", sourceField: "jobTitle", targetField: "role", transformationRule: "Title case parsing", status: "Mapped" },
    { id: "MAP-003", sourceField: "custom_status", targetField: "status", transformationRule: "Value mapping list", status: "Mapped" },
    { id: "MAP-004", sourceField: "cost_center", targetField: "department", transformationRule: "Prefix removal and routing", status: "Mapped" },
    { id: "MAP-005", sourceField: "dept_code", targetField: "department_id", transformationRule: "Lookup code table", status: "Conflict" }
  ],
  syncLogs: [
    { id: "LOG-001", timestamp: "2026-06-11 23:45:00", operation: "Data Push", subject: "Attendance_Feed", status: "Success", details: "Pushed 45 records to SuccessFactors endpoint" },
    { id: "LOG-002", timestamp: "2026-06-11 23:30:12", operation: "Schema Update", subject: "User_Object_Extension", status: "Failed", details: "SuccessFactors API rejected schema extension: Out of limits" },
    { id: "LOG-003", timestamp: "2026-06-11 23:10:55", operation: "Field Map", subject: "Employee_Dept_Code", status: "Warning", details: "Implicit mapping resolver used for code: QA_OPS" }
  ],
  announcements: [
    { id: "ANN-001", title: "Summer Working Hours", content: "Following the national directives, summer working hours for outdoor sites will change starting next week. Please check in early.", timestamp: "2026-06-11T12:00:00Z", author: "HR Department", category: "Urgent" },
    { id: "ANN-002", title: "SuccessFactors Sync Upgrade", content: "The SAP SuccessFactors bridge integration will undergo a schema update this Friday night. System availability might be affected for 10 minutes.", timestamp: "2026-06-10T15:00:00Z", author: "IT Infrastructure", category: "System Update" }
  ],
  worksites: [
    { id: "WORK-001", name: "Doha Headquarters (West Bay)", lat: 25.3186, lng: 51.5284, radiusMeters: 150.0, isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ],
  attendanceCorrections: [],
  leaveTypes: [
    { id: "LTYPE-ANNUAL", name: "Annual Leave", code: "ANNUAL", isActive: true, accruable: true, carryForward: true, maxCarryOver: 5.0, expiryMonths: 12, colorCode: "#0058be" },
    { id: "LTYPE-SICK", name: "Sick Leave", code: "SICK", isActive: true, accruable: false, carryForward: false, maxCarryOver: 0.0, expiryMonths: 0, colorCode: "#ea4335" },
    { id: "LTYPE-EMERGENCY", name: "Emergency Leave", code: "EMERGENCY", isActive: true, accruable: false, carryForward: false, maxCarryOver: 0.0, expiryMonths: 0, colorCode: "#fbbc05" },
    { id: "LTYPE-UNPAID", name: "Unpaid Leave", code: "UNPAID", isActive: true, accruable: false, carryForward: false, maxCarryOver: 0.0, expiryMonths: 0, colorCode: "#70757a" },
    { id: "LTYPE-BUSINESS", name: "Business Travel", code: "BUSINESS_TRAVEL", isActive: true, accruable: false, carryForward: false, maxCarryOver: 0.0, expiryMonths: 0, colorCode: "#34a853" }
  ],
  holidays: [
    { id: "HOL-001", name: "Qatar National Sports Day", date: "2026-02-10T00:00:00Z", isRecurring: true, scope: "NATIONAL" },
    { id: "HOL-002", name: "Qatar National Day", date: "2026-12-18T00:00:00Z", isRecurring: true, scope: "NATIONAL" },
    { id: "HOL-003", name: "Company Eid Al-Fitr Break", date: "2026-03-20T00:00:00Z", isRecurring: false, scope: "COMPANY" },
    { id: "HOL-004", name: "Company Eid Al-Adha Break", date: "2026-05-27T00:00:00Z", isRecurring: false, scope: "COMPANY" }
  ],
  leaveBalances: [],
  leaveBalanceLedgers: [],
  leaveApprovalWorkflows: [
    { id: "WF-ANNUAL", name: "Standard Annual Leave Workflow", description: "Multi-level approval flow for annual vacations", isActive: true },
    { id: "WF-SICK", name: "Sick & Emergency Leave Workflow", description: "Shortened approval flow for health emergencies", isActive: true },
    { id: "WF-BUSINESS-AUTO", name: "Auto Approval for Short Business Travel", description: "Instant approval for business trips <= 1 day", isActive: true }
  ],
  leaveApprovalSteps: [
    { id: "WFS-ANNUAL-1", workflowId: "WF-ANNUAL", stepNumber: 1, roleRequired: "SUPERVISOR", autoApprove: false },
    { id: "WFS-ANNUAL-2", workflowId: "WF-ANNUAL", stepNumber: 2, roleRequired: "MANAGER", autoApprove: false },
    { id: "WFS-ANNUAL-3", workflowId: "WF-ANNUAL", stepNumber: 3, roleRequired: "HR", autoApprove: false },
    { id: "WFS-SICK-1", workflowId: "WF-SICK", stepNumber: 1, roleRequired: "SUPERVISOR", autoApprove: false },
    { id: "WFS-SICK-2", workflowId: "WF-SICK", stepNumber: 2, roleRequired: "HR", autoApprove: false },
    { id: "WFS-BUSINESS-1", workflowId: "WF-BUSINESS-AUTO", stepNumber: 1, roleRequired: "HR", autoApprove: true, employeeGroupFilter: "all" }
  ],
  leaveApprovalHistories: [],
  leaveApprovalDelegations: [
    { id: "DELEG-001", employeeId: "SK-90210", delegateApproverId: "AD-0001", validFrom: "2026-06-01T00:00:00Z", validTo: "2026-06-30T00:00:00Z", reason: "Annual leave coverage" }
  ],
  shiftTemplates: [
    { id: "WF-SH-MORN", name: "Morning Shift", startTime: "06:00", endTime: "14:00", isSplit: false, isFlexible: false },
    { id: "WF-SH-EVE", name: "Evening Shift", startTime: "14:00", endTime: "22:00", isSplit: false, isFlexible: false },
    { id: "WF-SH-NIGHT", name: "Night Shift", startTime: "22:00", endTime: "06:00", isSplit: false, isFlexible: false },
    { id: "WF-SH-SPLIT", name: "Split Shift", startTime: "08:00", endTime: "12:00", isSplit: true, splitStart: "16:00", splitEnd: "20:00", isFlexible: false },
    { id: "WF-SH-FLEX", name: "Flexible Shift", startTime: "00:00", endTime: "24:00", isSplit: false, isFlexible: true, coreHours: 8.0 }
  ],
  rotationTemplates: [
    { id: "ROT-5X2", name: "5x2 Pattern", cycleDays: 7, patternJson: '["WF-SH-MORN","WF-SH-MORN","WF-SH-MORN","WF-SH-MORN","WF-SH-MORN","REST","REST"]' },
    { id: "ROT-6X1", name: "6x1 Pattern", cycleDays: 7, patternJson: '["WF-SH-MORN","WF-SH-MORN","WF-SH-MORN","WF-SH-MORN","WF-SH-MORN","WF-SH-MORN","REST"]' },
    { id: "ROT-4X4", name: "4 On / 4 Off", cycleDays: 8, patternJson: '["WF-SH-MORN","WF-SH-MORN","WF-SH-MORN","WF-SH-MORN","REST","REST","REST","REST"]' }
  ],
  shiftAssignments: [
    { id: "ASSIGN-001", employeeId: "AA-1001", employeeName: "Ahmed Ali", shiftTemplateId: "WF-SH-MORN", date: "2026-06-12" },
    { id: "ASSIGN-002", employeeId: "AA-1001", employeeName: "Ahmed Ali", shiftTemplateId: "WF-SH-MORN", date: "2026-06-13" },
    { id: "ASSIGN-003", employeeId: "AA-1001", employeeName: "Ahmed Ali", shiftTemplateId: "WF-SH-MORN", date: "2026-06-14" },
    { id: "ASSIGN-004", employeeId: "AA-1001", employeeName: "Ahmed Ali", shiftTemplateId: "WF-SH-MORN", date: "2026-06-15" }
  ],
  shiftSwaps: [],
  overtimeRates: [
    { id: "RATE-STD", name: "Standard Overtime Rate", overtimeType: "STANDARD_OT", multiplier: 1.25, currency: "QAR", appliesOnWeekend: false, appliesOnHoliday: false, appliesAfterMinutes: 0, isActive: true },
    { id: "RATE-WKD", name: "Weekend Overtime Rate", overtimeType: "WEEKEND_OT", multiplier: 1.5, currency: "QAR", appliesOnWeekend: true, appliesOnHoliday: false, appliesAfterMinutes: 0, isActive: true },
    { id: "RATE-HOL", name: "Holiday Overtime Rate", overtimeType: "HOLIDAY_OT", multiplier: 2.0, currency: "QAR", appliesOnWeekend: false, appliesOnHoliday: true, appliesAfterMinutes: 0, isActive: true },
    { id: "RATE-NGT", name: "Night Overtime Rate", overtimeType: "NIGHT_OT", multiplier: 1.25, currency: "QAR", appliesOnWeekend: false, appliesOnHoliday: false, appliesAfterMinutes: 0, isActive: true },
    { id: "RATE-SPC", name: "Special Event Overtime Rate", overtimeType: "SPECIAL_EVENT_OT", multiplier: 1.5, currency: "QAR", appliesOnWeekend: false, appliesOnHoliday: false, appliesAfterMinutes: 0, isActive: true }
  ],
  sapConnections: [
    {
      id: "CONN-SF-SANDBOX",
      systemName: "SAP SuccessFactors Sandbox",
      odataUrl: "https://api.sandbox.successfactors.eu/odata/v2",
      clientId: "AHH_WFM_INTEGRATION_CLIENT",
      companyId: "AlHattabWFM",
      userId: "sf_sync_user",
      privateKeyVaultId: "VAULT_REF_SF_SANDBOX_KEY",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  sapFieldMappings: [
    { id: "FMAP-001", module: "EMPLOYEE", sourceField: "personalInfo.firstName", targetField: "name", transformRule: "Direct", validationRules: "REQUIRED", isRequired: true, isActive: true },
    { id: "FMAP-002", module: "EMPLOYEE", sourceField: "personalInfo.email", targetField: "email", transformRule: "Lowercase", validationRules: "EMAIL", isRequired: true, isActive: true },
    { id: "FMAP-003", module: "EMPLOYEE", sourceField: "jobInfo.department", targetField: "department", transformRule: "Lookup", validationRules: "REQUIRED", isRequired: true, isActive: true },
    { id: "FMAP-004", module: "EMPLOYEE", sourceField: "jobInfo.status", targetField: "status", transformRule: "ValueMap", validationRules: "", isRequired: false, isActive: true }
  ],
  sapSyncJobs: [],
  sapSyncLogs: [],
  sapRetryQueues: []
};

// Seeding helper to pre-fill MySQL with mock data if it is empty
let isSeeded = false;
const seedMySQL = async () => {
  if (isSeeded) return;
  if (!isDbConnected()) return;
  
  try {
    const empCount = await prismaClient.employee.count();
    if (empCount === 0) {
      console.log("MySQL database is empty. Seeding mock data...");
      
      // Seed departments
      for (const dept of memoryDb.departments) {
        await prismaClient.department.create({
          data: {
            id: dept.id,
            name: dept.name,
            createdAt: new Date(dept.createdAt),
            updatedAt: new Date(dept.updatedAt)
          }
        });
      }
      
      // Seed employees
      for (const emp of memoryDb.employees) {
        await prismaClient.employee.create({ data: emp });
      }
      
      // Seed shifts
      for (const shift of memoryDb.shifts) {
        await prismaClient.shift.create({ data: shift });
      }

      // Seed worksites
      for (const site of (memoryDb as any).worksites) {
        await prismaClient.worksite.create({
          data: {
            id: site.id,
            name: site.name,
            lat: site.lat,
            lng: site.lng,
            radiusMeters: site.radiusMeters,
            isActive: site.isActive,
            createdAt: new Date(site.createdAt),
            updatedAt: new Date(site.updatedAt)
          }
        });
      }
      
      // Seed attendance records
      for (const att of memoryDb.attendance) {
        await prismaClient.attendanceRecord.create({
          data: {
            id: att.id,
            employeeId: att.employeeId,
            employeeName: att.employeeName,
            checkIn: new Date(att.checkIn),
            checkOut: att.checkOut ? new Date(att.checkOut) : null,
            originalCheckIn: new Date(att.checkIn),
            originalCheckOut: att.checkOut ? new Date(att.checkOut) : null,
            lat: att.lat,
            lng: att.lng,
            device: att.device,
            status: att.status === "On Time" ? "ON_TIME" : (att.status === "Late" ? "LATE" : att.status),
            locationName: att.locationName,
            worksiteId: "WORK-001"
          }
        });
      }

      // Seed Leave Types
      for (const lt of memoryDb.leaveTypes) {
        await prismaClient.leaveType.create({ data: lt });
      }

      // Seed Workflows
      for (const wf of memoryDb.leaveApprovalWorkflows) {
        await prismaClient.leaveApprovalWorkflow.create({ data: wf });
      }
      
      // Seed Steps
      for (const step of memoryDb.leaveApprovalSteps) {
        await prismaClient.leaveApprovalStep.create({ data: step });
      }

      // Seed Delegations
      for (const del of memoryDb.leaveApprovalDelegations) {
        await prismaClient.leaveApprovalDelegation.create({
          data: {
            id: del.id,
            employeeId: del.employeeId,
            delegateApproverId: del.delegateApproverId,
            validFrom: new Date(del.validFrom),
            validTo: new Date(del.validTo),
            reason: del.reason
          }
        });
      }

      // Seed Holidays
      for (const hol of memoryDb.holidays) {
        await prismaClient.holiday.create({
          data: {
            id: hol.id,
            name: hol.name,
            date: new Date(hol.date),
            isRecurring: hol.isRecurring,
            scope: hol.scope
          }
        });
      }

      // Seed Employee balances
      const employees = await prismaClient.employee.findMany();
      for (const emp of employees) {
        // Annual Leave
        const balAnnual = await prismaClient.leaveBalance.create({
          data: {
            employeeId: emp.id,
            leaveTypeId: "LTYPE-ANNUAL",
            allocatedDays: 22.0,
            usedDays: 0.0,
            pendingDays: 0.0,
            carriedOver: 0.0
          }
        });
        await prismaClient.leaveBalanceLedger.create({
          data: {
            employeeId: emp.id,
            leaveTypeId: "LTYPE-ANNUAL",
            actionType: "INITIAL",
            amount: 22.0,
            balanceBefore: 0.0,
            balanceAfter: 22.0,
            remarks: "Initial seed allotment"
          }
        });

        // Sick Leave
        const balSick = await prismaClient.leaveBalance.create({
          data: {
            employeeId: emp.id,
            leaveTypeId: "LTYPE-SICK",
            allocatedDays: 15.0,
            usedDays: 0.0,
            pendingDays: 0.0,
            carriedOver: 0.0
          }
        });
        await prismaClient.leaveBalanceLedger.create({
          data: {
            employeeId: emp.id,
            leaveTypeId: "LTYPE-SICK",
            actionType: "INITIAL",
            amount: 15.0,
            balanceBefore: 0.0,
            balanceAfter: 15.0,
            remarks: "Initial seed allotment"
          }
        });
      }
      
      // Seed leaves
      for (const leave of memoryDb.leaves) {
        // Find matching leave type by name mapping
        const lt = memoryDb.leaveTypes.find(t => t.name === leave.type);
        const { start, end } = parseDateRange(leave.dateRange);
        await prismaClient.leaveRequest.create({
          data: {
            id: leave.id,
            employeeId: leave.employeeId,
            employeeName: leave.employeeName,
            type: leave.type,
            dateRange: leave.dateRange,
            reason: leave.reason,
            status: leave.status,
            startDate: start,
            endDate: end,
            totalDays: 2.0, // approximate
            leaveTypeId: lt ? lt.id : null
          }
        });
      }
      
      // Seed SAP mapping
      for (const map of memoryDb.sapMappings) {
        await prismaClient.sapMapping.create({ data: map });
      }
      
      // Seed logs
      for (const log of memoryDb.syncLogs) {
        await prismaClient.syncLog.create({
          data: {
            id: log.id,
            timestamp: new Date(log.timestamp.replace(" ", "T") + "Z"),
            operation: log.operation,
            subject: log.subject,
            status: log.status,
            details: log.details
          }
        });
      }
      
      // Seed announcements
      for (const ann of memoryDb.announcements) {
        await prismaClient.announcement.create({
          data: {
            id: ann.id,
            title: ann.title,
            content: ann.content,
            timestamp: new Date(ann.timestamp),
            author: ann.author,
            category: ann.category
          }
        });
      }
      // Seed Shift Templates
      for (const st of memoryDb.shiftTemplates) {
        await prismaClient.shiftTemplate.create({ data: st });
      }

      // Seed Rotation Templates
      for (const rt of memoryDb.rotationTemplates) {
        await prismaClient.rotationTemplate.create({ data: rt });
      }

      // Seed Shift Assignments
      for (const sa of memoryDb.shiftAssignments) {
        await prismaClient.shiftAssignment.create({
          data: {
            id: sa.id,
            employeeId: sa.employeeId,
            shiftTemplateId: sa.shiftTemplateId,
            date: new Date(sa.date)
          }
        });
      }

      // Seed Overtime Rates
      for (const rate of memoryDb.overtimeRates) {
        await prismaClient.overtimeRate.create({
          data: {
            id: rate.id,
            name: rate.name,
            overtimeType: rate.overtimeType,
            multiplier: rate.multiplier,
            fixedRateAmount: rate.fixedRateAmount || null,
            currency: rate.currency || "QAR",
            appliesOnWeekend: rate.appliesOnWeekend,
            appliesOnHoliday: rate.appliesOnHoliday,
            appliesAfterMinutes: rate.appliesAfterMinutes || 0,
            isActive: rate.isActive
          }
        });
      }

      // Seed SAP Connections
      for (const conn of memoryDb.sapConnections) {
        await prismaClient.sapConnection.create({
          data: {
            id: conn.id,
            systemName: conn.systemName,
            odataUrl: conn.odataUrl,
            clientId: conn.clientId,
            companyId: conn.companyId,
            userId: conn.userId,
            privateKeyVaultId: conn.privateKeyVaultId,
            isActive: conn.isActive,
            createdAt: new Date(conn.createdAt!),
            updatedAt: new Date(conn.updatedAt!)
          }
        });
      }

      // Seed SAP Field Mappings
      for (const fmap of memoryDb.sapFieldMappings) {
        await prismaClient.sapFieldMapping.create({
          data: {
            id: fmap.id,
            module: fmap.module,
            sourceField: fmap.sourceField,
            targetField: fmap.targetField,
            transformRule: fmap.transformRule || null,
            validationRules: fmap.validationRules || null,
            isRequired: fmap.isRequired,
            isActive: fmap.isActive
          }
        });
      }

      console.log("MySQL Database seeded successfully!");
    }
    isSeeded = true;
  } catch (e) {
    console.error("Failed to seed MySQL database", e);
  }
};

// JSON file database resolution on disk (Node.js environment fallback)
const getDbPath = () => {
  if (typeof window !== "undefined") return "";
  
  try {
    const rootPath = "D:\\AI Projects\\AHH WFM\app";
    const dbDir = path.join(rootPath, "packages", "mock-data");
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    return path.join(dbDir, "db.json");
  } catch (e) {
    return "";
  }
};

const readDb = (): typeof memoryDb & { worksites: Worksite[]; attendanceCorrections: AttendanceCorrection[] } => {
  const dbPath = getDbPath();
  if (!dbPath) return memoryDb as any;
  
  try {
    if (!fs.existsSync(dbPath)) {
      writeDb(memoryDb as any);
      return memoryDb as any;
    }
    const data = fs.readFileSync(dbPath, "utf-8");
    const parsed = JSON.parse(data);
    if (!parsed.worksites) {
      parsed.worksites = memoryDb.worksites;
    }
    if (!parsed.attendanceCorrections) {
      parsed.attendanceCorrections = [];
    }
    if (!parsed.leaveTypes) {
      parsed.leaveTypes = memoryDb.leaveTypes;
    }
    if (!parsed.holidays) {
      parsed.holidays = memoryDb.holidays;
    }
    if (!parsed.leaveBalances || parsed.leaveBalances.length === 0) {
      parsed.leaveBalances = [];
      parsed.leaveBalanceLedgers = parsed.leaveBalanceLedgers || [];
      const employeesList = parsed.employees || memoryDb.employees;
      for (const emp of employeesList) {
        parsed.leaveBalances.push({
          id: `BAL-ANNUAL-${emp.id}`,
          employeeId: emp.id,
          leaveTypeId: "LTYPE-ANNUAL",
          allocatedDays: 22.0,
          usedDays: 0.0,
          pendingDays: 0.0,
          carriedOver: 0.0
        });
        parsed.leaveBalances.push({
          id: `BAL-SICK-${emp.id}`,
          employeeId: emp.id,
          leaveTypeId: "LTYPE-SICK",
          allocatedDays: 15.0,
          usedDays: 0.0,
          pendingDays: 0.0,
          carriedOver: 0.0
        });
        parsed.leaveBalanceLedgers.push({
          id: `LEDG-ANNUAL-${emp.id}-${Date.now()}`,
          employeeId: emp.id,
          leaveTypeId: "LTYPE-ANNUAL",
          actionType: "INITIAL",
          amount: 22.0,
          balanceBefore: 0.0,
          balanceAfter: 22.0,
          remarks: "Initial seed allotment"
        });
        parsed.leaveBalanceLedgers.push({
          id: `LEDG-SICK-${emp.id}-${Date.now()}`,
          employeeId: emp.id,
          leaveTypeId: "LTYPE-SICK",
          actionType: "INITIAL",
          amount: 15.0,
          balanceBefore: 0.0,
          balanceAfter: 15.0,
          remarks: "Initial seed allotment"
        });
      }
    }
    if (!parsed.leaveBalanceLedgers) {
      parsed.leaveBalanceLedgers = [];
    }
    if (!parsed.leaveApprovalWorkflows) {
      parsed.leaveApprovalWorkflows = memoryDb.leaveApprovalWorkflows;
    }
    if (!parsed.leaveApprovalSteps) {
      parsed.leaveApprovalSteps = memoryDb.leaveApprovalSteps;
    }
    if (!parsed.leaveApprovalHistories) {
      parsed.leaveApprovalHistories = [];
    }
    if (!parsed.leaveApprovalDelegations) {
      parsed.leaveApprovalDelegations = memoryDb.leaveApprovalDelegations;
    }
    if (!parsed.shiftTemplates) {
      parsed.shiftTemplates = memoryDb.shiftTemplates;
    }
    if (!parsed.rotationTemplates) {
      parsed.rotationTemplates = memoryDb.rotationTemplates;
    }
    if (!parsed.shiftAssignments) {
      parsed.shiftAssignments = memoryDb.shiftAssignments;
    }
    if (!parsed.shiftSwaps) {
      parsed.shiftSwaps = memoryDb.shiftSwaps || [];
    }
    if (!parsed.overtimeRates) {
      parsed.overtimeRates = memoryDb.overtimeRates || [];
    }
    return parsed;
  } catch (e) {
    console.error("Failed to read JSON DB, using memory fallback", e);
    return memoryDb as any;
  }
};

const writeDb = (data: typeof memoryDb & { worksites: Worksite[]; attendanceCorrections: AttendanceCorrection[] }) => {
  memoryDb = data as any;
  const dbPath = getDbPath();
  if (!dbPath) return;
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write to JSON DB", e);
  }
};
  
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = lat1 * Math.PI/180;
  const phi2 = lat2 * Math.PI/180;
  const deltaPhi = (lat2-lat1) * Math.PI/180;
  const deltaLambda = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function getShiftStartTimeToday(timeRange: string): Date | null {
  try {
    const startStr = timeRange.split(/—|-|to/)[0].trim(); // e.g. "09:00 AM"
    const parts = startStr.split(" ");
    const timeParts = parts[0].split(":");
    let hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    const ampm = parts[1].toUpperCase();

    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;

    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  } catch (e) {
    return null;
  }
}

// Data Mapper Helpers for Prisma Types -> TypeScript Interfaces
const mapAttendance = (rec: any): AttendanceRecord => ({
  id: rec.id,
  employeeId: rec.employeeId,
  employeeName: rec.employeeName,
  checkIn: rec.checkIn instanceof Date ? rec.checkIn.toISOString() : rec.checkIn,
  checkOut: rec.checkOut ? (rec.checkOut instanceof Date ? rec.checkOut.toISOString() : rec.checkOut) : undefined,
  originalCheckIn: rec.originalCheckIn instanceof Date ? rec.originalCheckIn.toISOString() : rec.originalCheckIn,
  originalCheckOut: rec.originalCheckOut ? (rec.originalCheckOut instanceof Date ? rec.originalCheckOut.toISOString() : rec.originalCheckOut) : undefined,
  lat: rec.lat,
  lng: rec.lng,
  device: rec.device,
  status: rec.status,
  locationName: rec.locationName,
  worksiteId: rec.worksiteId || undefined,
  shiftId: rec.shiftId || undefined,
  shiftStartSnapshot: rec.shiftStartSnapshot || undefined,
  shiftEndSnapshot: rec.shiftEndSnapshot || undefined,
  lateMinutes: rec.lateMinutes || 0,
  standardOtMinutes: rec.standardOtMinutes || 0,
  weekendOtMinutes: rec.weekendOtMinutes || 0,
  holidayOtMinutes: rec.holidayOtMinutes || 0,
  nightOtMinutes: rec.nightOtMinutes || 0,
  specialEventOtMinutes: rec.specialEventOtMinutes || 0,
  otApprovedMinutes: rec.otApprovedMinutes || 0,
  overtimePayAmount: rec.overtimePayAmount || 0,
  otStatus: rec.otStatus || "PENDING"
});

const mapWorksite = (rec: any): Worksite => ({
  id: rec.id,
  name: rec.name,
  lat: rec.lat,
  lng: rec.lng,
  radiusMeters: rec.radiusMeters,
  isActive: rec.isActive,
  createdAt: rec.createdAt instanceof Date ? rec.createdAt.toISOString() : rec.createdAt,
  updatedAt: rec.updatedAt instanceof Date ? rec.updatedAt.toISOString() : rec.updatedAt
});

const mapCorrection = (rec: any): AttendanceCorrection => ({
  id: rec.id,
  attendanceRecordId: rec.attendanceRecordId,
  requestedCheckIn: rec.requestedCheckIn ? (rec.requestedCheckIn instanceof Date ? rec.requestedCheckIn.toISOString() : rec.requestedCheckIn) : undefined,
  requestedCheckOut: rec.requestedCheckOut ? (rec.requestedCheckOut instanceof Date ? rec.requestedCheckOut.toISOString() : rec.requestedCheckOut) : undefined,
  reason: rec.reason,
  status: rec.status,
  reviewedById: rec.reviewedById || undefined,
  reviewNotes: rec.reviewNotes || undefined,
  createdAt: rec.createdAt instanceof Date ? rec.createdAt.toISOString() : rec.createdAt,
  updatedAt: rec.updatedAt instanceof Date ? rec.updatedAt.toISOString() : rec.updatedAt
});

const mapSyncLog = (log: any): SyncLog => ({
  id: log.id,
  timestamp: log.timestamp.toISOString().replace("T", " ").substring(0, 19),
  operation: log.operation,
  subject: log.subject,
  status: log.status,
  details: log.details
});

const mapAnnouncement = (ann: any): Announcement => ({
  id: ann.id,
  title: ann.title,
  content: ann.content,
  timestamp: ann.timestamp.toISOString(),
  author: ann.author,
  category: ann.category
});

// Database CRUD Actions API (All Async to support DB connection)
export const mockDb = {
  // Employees
  getEmployees: async (): Promise<Employee[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.employee.findMany();
    }
    return readDb().employees;
  },
  updateEmployeeStatus: async (id: string, status: Employee["status"]): Promise<Employee | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const emp = await prismaClient.employee.update({
          where: { id },
          data: { status }
        });
        return emp;
      } catch (e) {
        return null;
      }
    }
    
    const db = readDb();
    const employee = db.employees.find(e => e.id === id);
    if (!employee) return null;
    employee.status = status;
    writeDb(db);
    return employee;
  },
  
  // Attendance
  getAttendance: async (): Promise<AttendanceRecord[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.attendanceRecord.findMany({
        orderBy: { checkIn: "desc" }
      });
      return records.map(mapAttendance);
    }
    return readDb().attendance;
  },
  checkIn: async (employeeId: string, lat: number, lng: number, device: string, locationName: string): Promise<AttendanceRecord> => {
    // Validate coordinates
    if (lat === undefined || lng === undefined || (lat === 0 && lng === 0) || isNaN(lat) || isNaN(lng)) {
      throw new Error("Invalid GPS coordinates");
    }

    if (isDbConnected()) {
      await seedMySQL();
      
      const employee = await prismaClient.employee.findUnique({ where: { id: employeeId } });
      if (!employee) throw new Error("Employee not found");
      if (employee.isActive === false) {
        throw new Error("Deactivated employees are not allowed to check in");
      }

      // Prevent duplicate open check-ins
      const active = await prismaClient.attendanceRecord.findFirst({
        where: { employeeId, checkOut: null }
      });
      if (active) {
        throw new Error("Employee already has an active check-in session");
      }

      // Check geofencing
      const worksites = await prismaClient.worksite.findMany();
      let matchedWorksite = null;
      let isOutOfZone = true;
      for (const site of worksites) {
        if (site.isActive) {
          const dist = calculateDistance(lat, lng, site.lat, site.lng);
          if (dist <= site.radiusMeters) {
            matchedWorksite = site;
            isOutOfZone = false;
            break;
          }
        }
      }

      // Calculate shift times & late minutes
      let lateMinutes = 0;
      let status = "ON_TIME";
      let shiftStartSnapshot = null;
      let shiftEndSnapshot = null;

      if (employee.shiftId) {
        const shift = await prismaClient.shift.findUnique({ where: { id: employee.shiftId } });
        if (shift) {
          const times = shift.timeRange.split(/—|-|to/);
          shiftStartSnapshot = times[0]?.trim() || null;
          shiftEndSnapshot = times[1]?.trim() || null;

          const expectedStart = getShiftStartTimeToday(shift.timeRange);
          if (expectedStart) {
            const now = new Date();
            const diffMs = now.getTime() - expectedStart.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins > 5) { // 5 mins grace
              lateMinutes = diffMins;
              status = "LATE";
            }
          }
        }
      }

      if (isOutOfZone) {
        status = "OUT_OF_ZONE";
      }

      // Update employee status to On Duty
      await prismaClient.employee.update({
        where: { id: employeeId },
        data: { status: "On Duty" }
      });

      const checkInTime = new Date();
      const record = await prismaClient.attendanceRecord.create({
        data: {
          employeeId,
          employeeName: employee.name,
          lat,
          lng,
          device,
          status,
          locationName,
          checkIn: checkInTime,
          originalCheckIn: checkInTime,
          worksiteId: matchedWorksite ? matchedWorksite.id : null,
          shiftId: employee.shiftId || null,
          shiftStartSnapshot,
          shiftEndSnapshot,
          lateMinutes
        }
      });

      await prismaClient.syncLog.create({
        data: {
          operation: "Data Push",
          subject: `Attendance_${employeeId}`,
          status: "Success",
          details: `Checked In from mobile at ${locationName} (${status})`,
          timestamp: new Date()
        }
      });

      return mapAttendance(record);
    }

    const db = readDb();
    const employee = db.employees.find(e => e.id === employeeId);
    if (!employee) throw new Error("Employee not found");
    if (employee.isActive === false) {
      throw new Error("Deactivated employees are not allowed to check in");
    }

    const activeFallback = db.attendance.find(r => r.employeeId === employeeId && !r.checkOut);
    if (activeFallback) {
      throw new Error("Employee already has an active check-in session");
    }

    // Geofencing fallback
    let matchedWorksiteId: string | undefined = undefined;
    let isOutOfZone = true;
    for (const site of db.worksites) {
      if (site.isActive) {
        const dist = calculateDistance(lat, lng, site.lat, site.lng);
        if (dist <= site.radiusMeters) {
          matchedWorksiteId = site.id;
          isOutOfZone = false;
          break;
        }
      }
    }

    // Late logic fallback
    let lateMinutes = 0;
    let status = "ON_TIME";
    let shiftStartSnapshot: string | undefined = undefined;
    let shiftEndSnapshot: string | undefined = undefined;

    if (employee.shiftId) {
      const shift = db.shifts.find(s => s.id === employee.shiftId);
      if (shift) {
        const times = shift.timeRange.split(/—|-|to/);
        shiftStartSnapshot = times[0]?.trim() || undefined;
        shiftEndSnapshot = times[1]?.trim() || undefined;

        const expectedStart = getShiftStartTimeToday(shift.timeRange);
        if (expectedStart) {
          const now = new Date();
          const diffMs = now.getTime() - expectedStart.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          if (diffMins > 5) {
            lateMinutes = diffMins;
            status = "LATE";
          }
        }
      }
    }

    if (isOutOfZone) {
      status = "OUT_OF_ZONE";
    }

    employee.status = "On Duty";
    const checkInTimeStr = new Date().toISOString();
    const record: AttendanceRecord = {
      id: `ATT-${Date.now()}`,
      employeeId,
      employeeName: employee.name,
      checkIn: checkInTimeStr,
      originalCheckIn: checkInTimeStr,
      lat,
      lng,
      device,
      status,
      locationName,
      worksiteId: matchedWorksiteId,
      shiftId: employee.shiftId || undefined,
      shiftStartSnapshot,
      shiftEndSnapshot,
      lateMinutes
    };

    db.attendance.unshift(record);

    db.syncLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      operation: "Data Push",
      subject: `Attendance_${employeeId}`,
      status: "Success",
      details: `Checked In from mobile at ${locationName} (${status})`
    });

    writeDb(db);
    return record;
  },
  checkOut: async (employeeId: string): Promise<AttendanceRecord | null> => {
    const parseTimeToMinutes = (t: string): number => {
      const parts = t.split(":");
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };

    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.attendanceRecord.findFirst({
        where: { employeeId, checkOut: null },
        orderBy: { checkIn: "desc" }
      });
      if (!record) {
        throw new Error("No active check-in session found for this employee");
      }

      const checkInTime = record.checkIn;
      const checkOutTime = new Date();
      const actualDuration = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
      const dateStr = checkInTime.toISOString().substring(0, 10);

      const assignments = await prismaClient.shiftAssignment.findMany({
        where: { employeeId },
        include: { shiftTemplate: true }
      });
      const assignment = assignments.find((a: any) => a.date.toISOString().substring(0, 10) === dateStr);

      let standardOt = 0;
      let weekendOt = 0;
      let holidayOt = 0;
      let nightOt = 0;
      let specialEventOt = 0;
      let estimatedPay = 0;

      const holidays = await prismaClient.holiday.findMany();
      const isHoliday = holidays.some((h: any) => h.date.toISOString().substring(0, 10) === dateStr);
      const dayOfWeek = checkInTime.getUTCDay();
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

      const rates = await prismaClient.overtimeRate.findMany({ where: { isActive: true } });
      const stdRate = rates.find((r: any) => r.overtimeType === "STANDARD_OT")?.multiplier || 1.25;
      const wkdRate = rates.find((r: any) => r.overtimeType === "WEEKEND_OT")?.multiplier || 1.5;
      const holRate = rates.find((r: any) => r.overtimeType === "HOLIDAY_OT")?.multiplier || 2.0;
      const nightRate = rates.find((r: any) => r.overtimeType === "NIGHT_OT")?.multiplier || 1.25;

      let scheduledMinutes = 480;
      if (assignment) {
        const st = assignment.shiftTemplate;
        if (st.isFlexible) {
          scheduledMinutes = (st.coreHours || 8) * 60;
        } else if (st.isSplit) {
          const p1 = Math.abs(parseTimeToMinutes(st.endTime) - parseTimeToMinutes(st.startTime));
          const p2 = st.splitStart && st.splitEnd ? Math.abs(parseTimeToMinutes(st.splitEnd) - parseTimeToMinutes(st.splitStart)) : 0;
          scheduledMinutes = p1 + p2;
        } else {
          const endMin = parseTimeToMinutes(st.endTime);
          const startMin = parseTimeToMinutes(st.startTime);
          scheduledMinutes = endMin >= startMin ? (endMin - startMin) : (24*60 - startMin + endMin);
        }
      }

      if (actualDuration > scheduledMinutes) {
        for (let m = 0; m < actualDuration; m++) {
          if (m >= scheduledMinutes) {
            const minTime = new Date(checkInTime.getTime() + m * 60000);
            const hour = minTime.getHours();
            const isNight = hour >= 22 || hour < 6;
            
            if (isNight) {
              nightOt++;
            } else if (isHoliday) {
              holidayOt++;
            } else if (isWeekend) {
              weekendOt++;
            } else {
              standardOt++;
            }
          }
        }

        const hourlyBase = 50.0;
        estimatedPay = (standardOt / 60 * hourlyBase * stdRate) +
                       (weekendOt / 60 * hourlyBase * wkdRate) +
                       (holidayOt / 60 * hourlyBase * holRate) +
                       (nightOt / 60 * hourlyBase * nightRate);
      }

      const updated = await prismaClient.attendanceRecord.update({
        where: { id: record.id },
        data: {
          checkOut: checkOutTime,
          originalCheckOut: checkOutTime,
          standardOtMinutes: standardOt,
          weekendOtMinutes: weekendOt,
          holidayOtMinutes: holidayOt,
          nightOtMinutes: nightOt,
          specialEventOtMinutes: specialEventOt,
          overtimePayAmount: estimatedPay,
          otStatus: "PENDING"
        }
      });

      await prismaClient.employee.update({
        where: { id: employeeId },
        data: { status: "Offline" }
      });

      return mapAttendance(updated);
    }

    const db = readDb();
    const record = db.attendance.find(r => r.employeeId === employeeId && !r.checkOut);
    if (!record) {
      throw new Error("No active check-in session found for this employee");
    }

    const checkInTime = new Date(record.checkIn);
    const checkOutTime = new Date();
    const checkOutTimeStr = checkOutTime.toISOString();
    const actualDuration = Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000);
    const dateStr = record.checkIn.substring(0, 10);

    const assignment = (db.shiftAssignments || []).find(a => a.employeeId === employeeId && a.date === dateStr);
    
    let standardOt = 0;
    let weekendOt = 0;
    let holidayOt = 0;
    let nightOt = 0;
    let specialEventOt = 0;
    let estimatedPay = 0;

    const isHoliday = (db.holidays || []).some(h => h.date.substring(0, 10) === dateStr);
    const dayOfWeek = checkInTime.getUTCDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    const stdRate = (db.overtimeRates || []).find(r => r.overtimeType === "STANDARD_OT")?.multiplier || 1.25;
    const wkdRate = (db.overtimeRates || []).find(r => r.overtimeType === "WEEKEND_OT")?.multiplier || 1.5;
    const holRate = (db.overtimeRates || []).find(r => r.overtimeType === "HOLIDAY_OT")?.multiplier || 2.0;
    const nightRate = (db.overtimeRates || []).find(r => r.overtimeType === "NIGHT_OT")?.multiplier || 1.25;

    let scheduledMinutes = 480;
    if (assignment) {
      const st = (db.shiftTemplates || []).find(t => t.id === assignment.shiftTemplateId);
      if (st) {
        if (st.isFlexible) {
          scheduledMinutes = (st.coreHours || 8) * 60;
        } else if (st.isSplit) {
          const p1 = Math.abs(parseTimeToMinutes(st.endTime) - parseTimeToMinutes(st.startTime));
          const p2 = st.splitStart && st.splitEnd ? Math.abs(parseTimeToMinutes(st.splitEnd) - parseTimeToMinutes(st.splitStart)) : 0;
          scheduledMinutes = p1 + p2;
        } else {
          const endMin = parseTimeToMinutes(st.endTime);
          const startMin = parseTimeToMinutes(st.startTime);
          scheduledMinutes = endMin >= startMin ? (endMin - startMin) : (24*60 - startMin + endMin);
        }
      }
    }

    if (actualDuration > scheduledMinutes) {
      for (let m = 0; m < actualDuration; m++) {
        if (m >= scheduledMinutes) {
          const minTime = new Date(checkInTime.getTime() + m * 60000);
          const hour = minTime.getHours();
          const isNight = hour >= 22 || hour < 6;
          
          if (isNight) {
            nightOt++;
          } else if (isHoliday) {
            holidayOt++;
          } else if (isWeekend) {
            weekendOt++;
          } else {
            standardOt++;
          }
        }
      }

      const hourlyBase = 50.0;
      estimatedPay = (standardOt / 60 * hourlyBase * stdRate) +
                     (weekendOt / 60 * hourlyBase * wkdRate) +
                     (holidayOt / 60 * hourlyBase * holRate) +
                     (nightOt / 60 * hourlyBase * nightRate);
    }

    record.checkOut = checkOutTimeStr;
    record.originalCheckOut = checkOutTimeStr;
    record.standardOtMinutes = standardOt;
    record.weekendOtMinutes = weekendOt;
    record.holidayOtMinutes = holidayOt;
    record.nightOtMinutes = nightOt;
    record.specialEventOtMinutes = specialEventOt;
    record.overtimePayAmount = estimatedPay;
    record.otStatus = "PENDING";

    const employee = db.employees.find(e => e.id === employeeId);
    if (employee) {
      employee.status = "Offline";
    }

    writeDb(db);
    return mapAttendance(record);
  },
  
  // Shifts
  getShifts: async (): Promise<Shift[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.shift.findMany();
    }
    return readDb().shifts;
  },
  addShift: async (shift: Omit<Shift, "id">): Promise<Shift> => {
    if (isDbConnected()) {
      await seedMySQL();
      const newShift = await prismaClient.shift.create({
        data: {
          id: shift.code,
          ...shift
        }
      });
      
      await prismaClient.syncLog.create({
        data: {
          operation: "Schema Update",
          subject: `Shift_${shift.code}`,
          status: "Success",
          details: `Created new shift ${shift.name} (${shift.timeRange})`,
          timestamp: new Date()
        }
      });
      
      return newShift;
    }

    const db = readDb();
    const newShift: Shift = {
      ...shift,
      id: shift.code
    };
    db.shifts.push(newShift);
    
    db.syncLogs.unshift({
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      operation: "Schema Update",
      subject: `Shift_${shift.code}`,
      status: "Success",
      details: `Created new shift ${shift.name} (${shift.timeRange})`
    });
    
    writeDb(db);
    return newShift;
  },
  
  // Leaves
  getLeaves: async (): Promise<LeaveRequest[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.leaveRequest.findMany();
    }
    return readDb().leaves;
  },
  applyLeave: async (employeeId: string, type: string, dateRange: string, reason: string): Promise<LeaveRequest> => {
    const { start, end } = parseDateRange(dateRange);
    
    if (isDbConnected()) {
      await seedMySQL();
      const employee = await prismaClient.employee.findUnique({ where: { id: employeeId } });
      const employeeName = employee ? employee.name : "Unknown Employee";
      
      const leaveType = await prismaClient.leaveType.findFirst({
        where: { name: { equals: type } }
      });
      const leaveTypeId = leaveType ? leaveType.id : null;
      
      const holidays = await prismaClient.holiday.findMany();
      let totalDays = 0;
      const current = new Date(start.getTime());
      current.setHours(12, 0, 0, 0);
      const target = new Date(end.getTime());
      target.setHours(12, 0, 0, 0);
      while (current <= target) {
        const dayOfWeek = current.getDay();
        const isWeekendVal = dayOfWeek === 5 || dayOfWeek === 6; // Friday & Saturday
        const isHolidayVal = holidays.some((h: any) => {
          const hDate = new Date(h.date);
          return hDate.getFullYear() === current.getFullYear() &&
                 hDate.getMonth() === current.getMonth() &&
                 hDate.getDate() === current.getDate();
        });
        if (!isWeekendVal && !isHolidayVal) {
          totalDays++;
        }
        current.setDate(current.getDate() + 1);
      }

      // Determine matching approval workflow
      let workflowId = null;
      let totalSteps = 1;
      let status = "Pending Approval";
      let approvedAt = null;
      let approvalDurationHours = null;

      if (type === "Business Travel" && totalDays <= 1) {
        workflowId = "WF-BUSINESS-AUTO";
        status = "Approved";
        approvedAt = new Date();
        approvalDurationHours = 0;
      } else if (type === "Annual Leave") {
        workflowId = "WF-ANNUAL";
        totalSteps = 3;
        status = "Pending Supervisor Approval";
      } else if (type === "Sick Leave" || type === "Emergency Leave") {
        workflowId = "WF-SICK";
        totalSteps = 2;
        status = "Pending Supervisor Approval";
      }

      if (leaveTypeId && leaveType.accruable && status !== "Approved") {
        const bal = await prismaClient.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId: { employeeId, leaveTypeId } }
        });
        if (bal) {
          await prismaClient.leaveBalance.update({
            where: { id: bal.id },
            data: { pendingDays: bal.pendingDays + totalDays }
          });
        }
      }

      // If auto-approved, handle balance immediately
      if (status === "Approved" && leaveTypeId && leaveType.accruable) {
        const bal = await prismaClient.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId: { employeeId, leaveTypeId } }
        });
        if (bal) {
          await prismaClient.leaveBalance.update({
            where: { id: bal.id },
            data: { usedDays: bal.usedDays + totalDays }
          });
          await prismaClient.leaveBalanceLedger.create({
            data: {
              employeeId,
              leaveTypeId,
              actionType: "LEAVE_TAKEN",
              amount: -totalDays,
              balanceBefore: bal.allocatedDays,
              balanceAfter: bal.allocatedDays - totalDays,
              remarks: "Auto-approved Business Travel"
            }
          });
        }
      }

      const request = await prismaClient.leaveRequest.create({
        data: {
          employeeId,
          employeeName,
          type,
          dateRange,
          reason,
          status,
          startDate: start,
          endDate: end,
          totalDays,
          leaveTypeId,
          currentStep: 1,
          totalSteps,
          workflowId,
          submittedAt: new Date(),
          approvedAt,
          approvalDurationHours,
          escalationCount: 0
        }
      });

      // Write submission history
      await prismaClient.leaveApprovalHistory.create({
        data: {
          leaveRequestId: request.id,
          action: "SUBMIT",
          remarks: "Leave request submitted by employee",
          previousStatus: "INITIAL",
          newStatus: status
        }
      });

      if (status === "Approved") {
        await prismaClient.leaveApprovalHistory.create({
          data: {
            leaveRequestId: request.id,
            action: "AUTO_APPROVE",
            remarks: "Request satisfies auto-approval threshold <= 1 day Business Travel",
            previousStatus: status,
            newStatus: "Approved"
          }
        });
        await prismaClient.employee.update({
          where: { id: employeeId },
          data: { status: "On Leave" }
        });
      }
      
      return request;
    }

    const db = readDb();
    const employee = db.employees.find(e => e.id === employeeId);
    const employeeName = employee ? employee.name : "Unknown Employee";
    
    const leaveType = db.leaveTypes.find(t => t.name === type);
    const leaveTypeId = leaveType ? leaveType.id : null;
    
    let totalDays = 0;
    const current = new Date(start.getTime());
    current.setHours(12, 0, 0, 0);
    const target = new Date(end.getTime());
    target.setHours(12, 0, 0, 0);
    while (current <= target) {
      const dayOfWeek = current.getDay();
      const isWeekendVal = dayOfWeek === 5 || dayOfWeek === 6;
      const isHolidayVal = db.holidays.some(h => {
        const hDate = new Date(h.date);
        return hDate.getFullYear() === current.getFullYear() &&
               hDate.getMonth() === current.getMonth() &&
               hDate.getDate() === current.getDate();
      });
      if (!isWeekendVal && !isHolidayVal) {
        totalDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    let workflowId: string | undefined = undefined;
    let totalSteps = 1;
    let status = "Pending Approval";
    let approvedAt: string | undefined = undefined;
    let approvalDurationHours: number | undefined = undefined;

    if (type === "Business Travel" && totalDays <= 1) {
      workflowId = "WF-BUSINESS-AUTO";
      status = "Approved";
      approvedAt = new Date().toISOString();
      approvalDurationHours = 0;
    } else if (type === "Annual Leave") {
      workflowId = "WF-ANNUAL";
      totalSteps = 3;
      status = "Pending Supervisor Approval";
    } else if (type === "Sick Leave" || type === "Emergency Leave") {
      workflowId = "WF-SICK";
      totalSteps = 2;
      status = "Pending Supervisor Approval";
    }

    if (leaveTypeId && leaveType?.accruable && status !== "Approved") {
      const bal = db.leaveBalances.find(b => b.employeeId === employeeId && b.leaveTypeId === leaveTypeId);
      if (bal) {
        bal.pendingDays += totalDays;
      }
    }

    if (status === "Approved" && leaveTypeId && leaveType?.accruable) {
      const bal = db.leaveBalances.find(b => b.employeeId === employeeId && b.leaveTypeId === leaveTypeId);
      if (bal) {
        bal.usedDays += totalDays;
        db.leaveBalanceLedgers.push({
          id: `LEDG-${Date.now()}`,
          employeeId,
          leaveTypeId,
          actionType: "LEAVE_TAKEN",
          amount: -totalDays,
          balanceBefore: bal.allocatedDays,
          balanceAfter: bal.allocatedDays - totalDays,
          remarks: "Auto-approved Business Travel",
          createdAt: new Date().toISOString()
        });
      }
    }

    const request: LeaveRequest = {
      id: `LV-${Date.now()}`,
      employeeId,
      employeeName,
      type,
      dateRange,
      reason,
      status,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalDays,
      leaveTypeId: leaveTypeId || undefined,
      currentStep: 1,
      totalSteps,
      workflowId: workflowId || undefined,
      submittedAt: new Date().toISOString(),
      approvedAt,
      approvalDurationHours,
      escalationCount: 0
    };

    db.leaves.unshift(request);
    db.leaveApprovalHistories = db.leaveApprovalHistories || [];
    db.leaveApprovalHistories.push({
      id: `HIST-${Date.now()}`,
      leaveRequestId: request.id,
      action: "SUBMIT",
      remarks: "Leave request submitted by employee",
      previousStatus: "INITIAL",
      newStatus: status,
      createdAt: new Date().toISOString()
    });

    if (status === "Approved") {
      db.leaveApprovalHistories.push({
        id: `HIST-${Date.now()}-AUTO`,
        leaveRequestId: request.id,
        action: "AUTO_APPROVE",
        remarks: "Request satisfies auto-approval threshold <= 1 day Business Travel",
        previousStatus: status,
        newStatus: "Approved",
        createdAt: new Date().toISOString()
      });
      if (employee) {
        employee.status = "On Leave";
      }
    }

    writeDb(db);
    return request;
  },
  updateLeaveStatus: async (id: string, status: LeaveRequest["status"]): Promise<LeaveRequest | null> => {
    // Keep this for backward compatibility (bypass approval steps)
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const originalReq = await prismaClient.leaveRequest.findUnique({
          where: { id }
        });
        if (!originalReq) return null;

        const request = await prismaClient.leaveRequest.update({
          where: { id },
          data: { status }
        });
        
        if (originalReq.status !== "Approved" && status === "Approved" && originalReq.leaveTypeId && originalReq.totalDays) {
          const leaveType = await prismaClient.leaveType.findUnique({ where: { id: originalReq.leaveTypeId } });
          if (leaveType && leaveType.accruable) {
            const bal = await prismaClient.leaveBalance.findUnique({
              where: { employeeId_leaveTypeId: { employeeId: originalReq.employeeId, leaveTypeId: originalReq.leaveTypeId } }
            });
            if (bal) {
              const newPending = Math.max(0, bal.pendingDays - originalReq.totalDays);
              const newUsed = bal.usedDays + originalReq.totalDays;
              await prismaClient.leaveBalance.update({
                where: { id: bal.id },
                data: { pendingDays: newPending, usedDays: newUsed }
              });
              await prismaClient.leaveBalanceLedger.create({
                data: {
                  employeeId: originalReq.employeeId,
                  leaveTypeId: originalReq.leaveTypeId,
                  actionType: "LEAVE_TAKEN",
                  amount: -originalReq.totalDays,
                  balanceBefore: bal.allocatedDays - bal.usedDays,
                  balanceAfter: bal.allocatedDays - newUsed,
                  referenceId: originalReq.id,
                  remarks: `Admin bypass leave approved: ${originalReq.reason}`
                }
              });
            }
          }
          await prismaClient.employee.update({
            where: { id: request.employeeId },
            data: { status: "On Leave" }
          });
        }
        
        await prismaClient.leaveApprovalHistory.create({
          data: {
            leaveRequestId: id,
            action: status === "Approved" ? "APPROVE" : "REJECT",
            remarks: "Status overridden by supervisor/administrator",
            previousStatus: originalReq.status,
            newStatus: status
          }
        });

        return request;
      } catch (e) {
        console.error(e);
        return null;
      }
    }

    const db = readDb();
    const request = db.leaves.find(l => l.id === id);
    if (!request) return null;
    const oldStatus = request.status;
    request.status = status;
    
    if (oldStatus !== "Approved" && status === "Approved" && request.leaveTypeId && request.totalDays) {
      const leaveType = db.leaveTypes.find(t => t.id === request.leaveTypeId);
      if (leaveType && leaveType.accruable) {
        const bal = db.leaveBalances.find(b => b.employeeId === request.employeeId && b.leaveTypeId === request.leaveTypeId);
        if (bal) {
          const newPending = Math.max(0, bal.pendingDays - request.totalDays);
          const newUsed = bal.usedDays + request.totalDays;
          bal.pendingDays = newPending;
          bal.usedDays = newUsed;
          
          db.leaveBalanceLedgers.push({
            id: `LEDG-${Date.now()}`,
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            actionType: "LEAVE_TAKEN",
            amount: -request.totalDays,
            balanceBefore: bal.allocatedDays - (bal.usedDays - request.totalDays),
            balanceAfter: bal.allocatedDays - newUsed,
            referenceId: request.id,
            remarks: `Admin bypass leave approved: ${request.reason}`,
            createdAt: new Date().toISOString()
          });
        }
      }
      const employee = db.employees.find(e => e.id === request.employeeId);
      if (employee) {
        employee.status = "On Leave";
      }
    }

    db.leaveApprovalHistories = db.leaveApprovalHistories || [];
    db.leaveApprovalHistories.push({
      id: `HIST-${Date.now()}`,
      leaveRequestId: id,
      action: status === "Approved" ? "APPROVE" : "REJECT",
      remarks: "Status overridden by supervisor/administrator",
      previousStatus: oldStatus,
      newStatus: status,
      createdAt: new Date().toISOString()
    });
    
    writeDb(db);
    return request;
  },

  // Leave Types
  getLeaveTypes: async (): Promise<LeaveType[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.leaveType.findMany({
        orderBy: { code: "asc" }
      });
    }
    return readDb().leaveTypes;
  },

  // Holidays
  getHolidays: async (): Promise<Holiday[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.holiday.findMany({
        orderBy: { date: "asc" }
      });
      return records.map((h: any) => ({
        id: h.id,
        name: h.name,
        date: h.date.toISOString(),
        isRecurring: h.isRecurring,
        scope: h.scope,
        siteId: h.siteId || undefined
      }));
    }
    return readDb().holidays;
  },
  createHoliday: async (name: string, date: string, scope: string, isRecurring: boolean, siteId?: string): Promise<Holiday> => {
    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.holiday.create({
        data: { name, date: new Date(date), scope, isRecurring, siteId }
      });
      return {
        id: record.id,
        name: record.name,
        date: record.date.toISOString(),
        isRecurring: record.isRecurring,
        scope: record.scope,
        siteId: record.siteId || undefined
      };
    }
    const db = readDb();
    const newHoliday: Holiday = {
      id: `HOL-${Date.now()}`,
      name,
      date,
      scope,
      isRecurring,
      siteId
    };
    db.holidays.push(newHoliday);
    writeDb(db);
    return newHoliday;
  },

  // Leave Balances
  getLeaveBalances: async (employeeId?: string): Promise<LeaveBalance[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const balances = await prismaClient.leaveBalance.findMany({
        where: employeeId ? { employeeId } : undefined,
        include: { leaveType: true }
      });
      return balances.map((b: any) => ({
        id: b.id,
        employeeId: b.employeeId,
        leaveTypeId: b.leaveTypeId,
        leaveType: b.leaveType,
        allocatedDays: b.allocatedDays,
        usedDays: b.usedDays,
        pendingDays: b.pendingDays,
        carriedOver: b.carriedOver,
        sapExternalId: b.sapExternalId || undefined
      }));
    }
    const db = readDb();
    let balances = db.leaveBalances;
    if (employeeId) {
      balances = balances.filter(b => b.employeeId === employeeId);
    }
    return balances.map(b => ({
      ...b,
      leaveType: db.leaveTypes.find(t => t.id === b.leaveTypeId)
    }));
  },
  
  adjustLeaveBalance: async (employeeId: string, leaveTypeId: string, amount: number, reason: string, adjustedById: string): Promise<LeaveBalance | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const bal = await prismaClient.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId: { employeeId, leaveTypeId } }
        });
        if (!bal) return null;

        const balanceBefore = bal.allocatedDays;
        const balanceAfter = balanceBefore + amount;

        const updated = await prismaClient.leaveBalance.update({
          where: { id: bal.id },
          data: { allocatedDays: balanceAfter }
        });

        await prismaClient.leaveBalanceLedger.create({
          data: {
            employeeId,
            leaveTypeId,
            actionType: "MANUAL_ADJUSTMENT",
            amount,
            balanceBefore,
            balanceAfter,
            remarks: `${reason} (Adjusted by ${adjustedById})`
          }
        });
        return {
          id: updated.id,
          employeeId: updated.employeeId,
          leaveTypeId: updated.leaveTypeId,
          allocatedDays: updated.allocatedDays,
          usedDays: updated.usedDays,
          pendingDays: updated.pendingDays,
          carriedOver: updated.carriedOver,
          sapExternalId: updated.sapExternalId || undefined
        };
      } catch (e) {
        console.error(e);
        return null;
      }
    }

    const db = readDb();
    const bal = db.leaveBalances.find(b => b.employeeId === employeeId && b.leaveTypeId === leaveTypeId);
    if (!bal) return null;

    const balanceBefore = bal.allocatedDays;
    const balanceAfter = balanceBefore + amount;
    bal.allocatedDays = balanceAfter;

    db.leaveBalanceLedgers.push({
      id: `LEDG-${Date.now()}`,
      employeeId,
      leaveTypeId,
      actionType: "MANUAL_ADJUSTMENT",
      amount,
      balanceBefore,
      balanceAfter,
      remarks: `${reason} (Adjusted by ${adjustedById})`,
      createdAt: new Date().toISOString()
    });

    writeDb(db);
    return bal;
  },

  getLeaveBalanceLedger: async (employeeId?: string): Promise<LeaveBalanceLedger[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const logs = await prismaClient.leaveBalanceLedger.findMany({
        where: employeeId ? { employeeId } : undefined,
        orderBy: { createdAt: "desc" },
        include: { leaveType: true }
      });
      return logs;
    }
    const db = readDb();
    let logs = db.leaveBalanceLedgers || [];
    if (employeeId) {
      logs = logs.filter(l => l.employeeId === employeeId);
    }
    return logs.map(l => ({
      ...l,
      leaveType: db.leaveTypes.find(t => t.id === l.leaveTypeId)
    }));
  },

  runMonthlyAccrual: async (): Promise<{ success: boolean; count: number }> => {
    const accrualAmount = 1.833;
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const balances = await prismaClient.leaveBalance.findMany({
          where: { leaveTypeId: "LTYPE-ANNUAL" }
        });
        for (const bal of balances) {
          const balanceBefore = bal.allocatedDays;
          const balanceAfter = balanceBefore + accrualAmount;
          await prismaClient.leaveBalance.update({
            where: { id: bal.id },
            data: { allocatedDays: balanceAfter }
          });
          await prismaClient.leaveBalanceLedger.create({
            data: {
              employeeId: bal.employeeId,
              leaveTypeId: "LTYPE-ANNUAL",
              actionType: "ACCRUAL",
              amount: accrualAmount,
              balanceBefore,
              balanceAfter,
              remarks: "Monthly pro-rata accrual"
            }
          });
        }
        return { success: true, count: balances.length };
      } catch (e) {
        console.error(e);
        return { success: false, count: 0 };
      }
    }

    const db = readDb();
    const annualBalances = db.leaveBalances.filter(b => b.leaveTypeId === "LTYPE-ANNUAL");
    for (const bal of annualBalances) {
      const balanceBefore = bal.allocatedDays;
      const balanceAfter = balanceBefore + accrualAmount;
      bal.allocatedDays = balanceAfter;
      db.leaveBalanceLedgers.push({
        id: `LEDG-${Date.now()}-${Math.random()}`,
        employeeId: bal.employeeId,
        leaveTypeId: "LTYPE-ANNUAL",
        actionType: "ACCRUAL",
        amount: accrualAmount,
        balanceBefore,
        balanceAfter,
        remarks: "Monthly pro-rata accrual",
        createdAt: new Date().toISOString()
      });
    }
    writeDb(db);
    return { success: true, count: annualBalances.length };
  },

  // Phase 3B Approval Workflows & SLA Checks
  approveLeaveRequest: async (requestId: string, remarks: string, approverEmail: string): Promise<LeaveRequest | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const request = await prismaClient.leaveRequest.findUnique({
          where: { id: requestId }
        });
        if (!request) return null;

        const previousStatus = request.status;
        const nextStep = request.currentStep + 1;
        
        let newStatus = request.status;
        let approvedAt = null;
        let approvalDurationHours = null;
        
        const firstActionAt = request.firstActionAt || new Date();

        if (nextStep > request.totalSteps) {
          newStatus = "Approved";
          approvedAt = new Date();
          const durationMs = approvedAt.getTime() - new Date(request.submittedAt).getTime();
          approvalDurationHours = durationMs / (1000 * 60 * 60);

          // Update balances
          if (request.leaveTypeId && request.totalDays) {
            const bal = await prismaClient.leaveBalance.findUnique({
              where: { employeeId_leaveTypeId: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId } }
            });
            if (bal) {
              const newPending = Math.max(0, bal.pendingDays - request.totalDays);
              const newUsed = bal.usedDays + request.totalDays;
              await prismaClient.leaveBalance.update({
                where: { id: bal.id },
                data: { pendingDays: newPending, usedDays: newUsed }
              });
              await prismaClient.leaveBalanceLedger.create({
                data: {
                  employeeId: request.employeeId,
                  leaveTypeId: request.leaveTypeId,
                  actionType: "LEAVE_TAKEN",
                  amount: -request.totalDays,
                  balanceBefore: bal.allocatedDays - bal.usedDays,
                  balanceAfter: bal.allocatedDays - newUsed,
                  referenceId: request.id,
                  remarks: `Approved in workflow: ${remarks}`
                }
              });
            }
          }
          await prismaClient.employee.update({
            where: { id: request.employeeId },
            data: { status: "On Leave" }
          });
        } else {
          // Move to next step roles e.g., MANAGER or HR
          if (request.workflowId === "WF-ANNUAL") {
            newStatus = nextStep === 2 ? "Pending Manager Approval" : "Pending HR Approval";
          } else if (request.workflowId === "WF-SICK") {
            newStatus = "Pending HR Approval";
          } else {
            newStatus = "Pending Approval";
          }
        }

        const updated = await prismaClient.leaveRequest.update({
          where: { id: requestId },
          data: {
            currentStep: nextStep > request.totalSteps ? request.currentStep : nextStep,
            status: newStatus,
            firstActionAt,
            approvedAt,
            approvalDurationHours
          }
        });

        await prismaClient.leaveApprovalHistory.create({
          data: {
            leaveRequestId: requestId,
            approverId: approverEmail,
            action: "APPROVE",
            remarks,
            previousStatus,
            newStatus
          }
        });

        return updated;
      } catch (e) {
        console.error(e);
        return null;
      }
    }

    const db = readDb();
    const request = db.leaves.find(l => l.id === requestId);
    if (!request) return null;

    const previousStatus = request.status;
    const nextStep = (request.currentStep || 1) + 1;
    const totalSteps = request.totalSteps || 1;
    
    let newStatus = request.status;
    let approvedAt: string | undefined = undefined;
    let approvalDurationHours: number | undefined = undefined;
    
    const firstActionAt = request.firstActionAt || new Date().toISOString();

    if (nextStep > totalSteps) {
      newStatus = "Approved";
      approvedAt = new Date().toISOString();
      const durationMs = new Date(approvedAt).getTime() - new Date(request.submittedAt || "").getTime();
      approvalDurationHours = durationMs / (1000 * 60 * 60);

      if (request.leaveTypeId && request.totalDays) {
        const bal = db.leaveBalances.find(b => b.employeeId === request.employeeId && b.leaveTypeId === request.leaveTypeId);
        if (bal) {
          const newPending = Math.max(0, bal.pendingDays - request.totalDays);
          const newUsed = bal.usedDays + request.totalDays;
          bal.pendingDays = newPending;
          bal.usedDays = newUsed;
          
          db.leaveBalanceLedgers.push({
            id: `LEDG-${Date.now()}`,
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            actionType: "LEAVE_TAKEN",
            amount: -request.totalDays,
            balanceBefore: bal.allocatedDays - (bal.usedDays - request.totalDays),
            balanceAfter: bal.allocatedDays - newUsed,
            referenceId: request.id,
            remarks: `Approved in workflow: ${remarks}`,
            createdAt: new Date().toISOString()
          });
        }
      }
      const employee = db.employees.find(e => e.id === request.employeeId);
      if (employee) {
        employee.status = "On Leave";
      }
    } else {
      if (request.workflowId === "WF-ANNUAL") {
        newStatus = nextStep === 2 ? "Pending Manager Approval" : "Pending HR Approval";
      } else if (request.workflowId === "WF-SICK") {
        newStatus = "Pending HR Approval";
      } else {
        newStatus = "Pending Approval";
      }
    }

    request.currentStep = nextStep > totalSteps ? request.currentStep : nextStep;
    request.status = newStatus;
    request.firstActionAt = firstActionAt;
    request.approvedAt = approvedAt;
    request.approvalDurationHours = approvalDurationHours;

    db.leaveApprovalHistories = db.leaveApprovalHistories || [];
    db.leaveApprovalHistories.push({
      id: `HIST-${Date.now()}`,
      leaveRequestId: requestId,
      approverId: approverEmail,
      action: "APPROVE",
      remarks,
      previousStatus,
      newStatus,
      createdAt: new Date().toISOString()
    });

    writeDb(db);
    return request;
  },

  rejectLeaveRequest: async (requestId: string, remarks: string, approverEmail: string): Promise<LeaveRequest | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const request = await prismaClient.leaveRequest.findUnique({
          where: { id: requestId }
        });
        if (!request) return null;

        const previousStatus = request.status;
        const newStatus = "Rejected";
        const firstActionAt = request.firstActionAt || new Date();

        const updated = await prismaClient.leaveRequest.update({
          where: { id: requestId },
          data: { status: newStatus, firstActionAt }
        });

        // Revert pending balances
        if (request.leaveTypeId && request.totalDays) {
          const bal = await prismaClient.leaveBalance.findUnique({
            where: { employeeId_leaveTypeId: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId } }
          });
          if (bal) {
            await prismaClient.leaveBalance.update({
              where: { id: bal.id },
              data: { pendingDays: Math.max(0, bal.pendingDays - request.totalDays) }
            });
          }
        }

        await prismaClient.leaveApprovalHistory.create({
          data: {
            leaveRequestId: requestId,
            approverId: approverEmail,
            action: "REJECT",
            remarks,
            previousStatus,
            newStatus
          }
        });

        return updated;
      } catch (e) {
        console.error(e);
        return null;
      }
    }

    const db = readDb();
    const request = db.leaves.find(l => l.id === requestId);
    if (!request) return null;

    const previousStatus = request.status;
    const newStatus = "Rejected";
    const firstActionAt = request.firstActionAt || new Date().toISOString();

    request.status = newStatus;
    request.firstActionAt = firstActionAt;

    if (request.leaveTypeId && request.totalDays) {
      const bal = db.leaveBalances.find(b => b.employeeId === request.employeeId && b.leaveTypeId === request.leaveTypeId);
      if (bal) {
        bal.pendingDays = Math.max(0, bal.pendingDays - request.totalDays);
      }
    }

    db.leaveApprovalHistories = db.leaveApprovalHistories || [];
    db.leaveApprovalHistories.push({
      id: `HIST-${Date.now()}`,
      leaveRequestId: requestId,
      approverId: approverEmail,
      action: "REJECT",
      remarks,
      previousStatus,
      newStatus,
      createdAt: new Date().toISOString()
    });

    writeDb(db);
    return request;
  },

  getLeaveApprovalHistory: async (requestId: string): Promise<LeaveApprovalHistory[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.leaveApprovalHistory.findMany({
        where: { leaveRequestId: requestId },
        orderBy: { createdAt: "asc" }
      });
      return records.map((h: any) => ({
        id: h.id,
        leaveRequestId: h.leaveRequestId,
        approverId: h.approverId || undefined,
        action: h.action,
        remarks: h.remarks || undefined,
        previousStatus: h.previousStatus,
        newStatus: h.newStatus,
        createdAt: h.createdAt.toISOString()
      }));
    }
    const db = readDb();
    db.leaveApprovalHistories = db.leaveApprovalHistories || [];
    return db.leaveApprovalHistories.filter(h => h.leaveRequestId === requestId);
  },

  getLeaveApprovalWorkflows: async (): Promise<LeaveApprovalWorkflow[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.leaveApprovalWorkflow.findMany({
        include: { steps: true }
      });
    }
    const db = readDb();
    return db.leaveApprovalWorkflows.map(w => ({
      ...w,
      steps: db.leaveApprovalSteps.filter(s => s.workflowId === w.id)
    }));
  },

  createLeaveApprovalWorkflow: async (name: string, description: string, isActive: boolean, steps: Array<{ stepNumber: number; roleRequired: string; autoApprove: boolean; departmentFilter?: string; gradeFilter?: string; employeeGroupFilter?: string }>): Promise<LeaveApprovalWorkflow> => {
    if (isDbConnected()) {
      await seedMySQL();
      const workflow = await prismaClient.leaveApprovalWorkflow.create({
        data: {
          name,
          description,
          isActive,
          steps: {
            create: steps.map(s => ({
              stepNumber: s.stepNumber,
              roleRequired: s.roleRequired,
              autoApprove: s.autoApprove,
              departmentFilter: s.departmentFilter,
              gradeFilter: s.gradeFilter,
              employeeGroupFilter: s.employeeGroupFilter
            }))
          }
        },
        include: { steps: true }
      });
      return workflow;
    }

    const db = readDb();
    const workflowId = `WF-${Date.now()}`;
    const newWorkflow: LeaveApprovalWorkflow = {
      id: workflowId,
      name,
      description,
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.leaveApprovalWorkflows = db.leaveApprovalWorkflows || [];
    db.leaveApprovalWorkflows.push(newWorkflow);

    db.leaveApprovalSteps = db.leaveApprovalSteps || [];
    const createdSteps = steps.map(s => {
      const step = {
        id: `STEP-${Date.now()}-${s.stepNumber}`,
        workflowId,
        stepNumber: s.stepNumber,
        roleRequired: s.roleRequired,
        autoApprove: s.autoApprove,
        departmentFilter: s.departmentFilter || undefined,
        gradeFilter: s.gradeFilter || undefined,
        employeeGroupFilter: s.employeeGroupFilter || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.leaveApprovalSteps.push(step);
      return step;
    });

    writeDb(db);
    return { ...newWorkflow, steps: createdSteps };
  },

  getLeaveApprovalDelegations: async (): Promise<LeaveApprovalDelegation[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.leaveApprovalDelegation.findMany();
      return records.map((d: any) => ({
        id: d.id,
        employeeId: d.employeeId,
        delegateApproverId: d.delegateApproverId,
        validFrom: d.validFrom.toISOString(),
        validTo: d.validTo.toISOString(),
        reason: d.reason,
        createdAt: d.createdAt.toISOString()
      }));
    }
    return readDb().leaveApprovalDelegations || [];
  },

  createLeaveApprovalDelegation: async (employeeId: string, delegateApproverId: string, validFrom: string, validTo: string, reason: string): Promise<LeaveApprovalDelegation> => {
    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.leaveApprovalDelegation.create({
        data: {
          employeeId,
          delegateApproverId,
          validFrom: new Date(validFrom),
          validTo: new Date(validTo),
          reason
        }
      });
      return {
        id: record.id,
        employeeId: record.employeeId,
        delegateApproverId: record.delegateApproverId,
        validFrom: record.validFrom.toISOString(),
        validTo: record.validTo.toISOString(),
        reason: record.reason,
        createdAt: record.createdAt.toISOString()
      };
    }
    const db = readDb();
    const newDelegation: LeaveApprovalDelegation = {
      id: `DELEG-${Date.now()}`,
      employeeId,
      delegateApproverId,
      validFrom,
      validTo,
      reason,
      createdAt: new Date().toISOString()
    };
    db.leaveApprovalDelegations = db.leaveApprovalDelegations || [];
    db.leaveApprovalDelegations.push(newDelegation);
    writeDb(db);
    return newDelegation;
  },

  runEscalationCheck: async (): Promise<{ success: boolean; warnings: number; escalations: number }> => {
    let warningCount = 0;
    let escalationCount = 0;
    const now = new Date();

    if (isDbConnected()) {
      await seedMySQL();
      try {
        const pendingLeaves = await prismaClient.leaveRequest.findMany({
          where: {
            status: { in: ["Pending Supervisor Approval", "Pending Manager Approval", "Pending HR Approval", "Pending Approval"] }
          }
        });

        for (const req of pendingLeaves) {
          // Mock escalation checking: diff between now and req.submittedAt in hours
          const lastDate = req.firstActionAt || req.submittedAt || new Date();
          const diffHours = (now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60);

          if (diffHours > 72) {
            // SLA Escalation threshold exceeded: auto-advance
            const nextStep = req.currentStep + 1;
            let newStatus = req.status;

            if (nextStep <= req.totalSteps) {
              if (req.workflowId === "WF-ANNUAL") {
                newStatus = nextStep === 2 ? "Pending Manager Approval" : "Pending HR Approval";
              } else if (req.workflowId === "WF-SICK") {
                newStatus = "Pending HR Approval";
              }
              
              await prismaClient.leaveRequest.update({
                where: { id: req.id },
                data: {
                  currentStep: nextStep,
                  status: newStatus,
                  escalationCount: req.escalationCount + 1
                }
              });

              await prismaClient.leaveApprovalHistory.create({
                data: {
                  leaveRequestId: req.id,
                  action: "ESCALATE",
                  remarks: "Auto-escalated due to 72 hours inactivity at current level",
                  previousStatus: req.status,
                  newStatus
                }
              });
              escalationCount++;
            }
          } else if (diffHours > 24 && req.escalationCount === 0) {
            // Log 24h escalation warning
            const historyExists = await prismaClient.leaveApprovalHistory.findFirst({
              where: { leaveRequestId: req.id, action: "ESCALATE", remarks: { startsWith: "SLA Warning" } }
            });
            if (!historyExists) {
              await prismaClient.leaveApprovalHistory.create({
                data: {
                  leaveRequestId: req.id,
                  action: "ESCALATE",
                  remarks: "SLA Warning: Pending for more than 24 hours.",
                  previousStatus: req.status,
                  newStatus: req.status
                }
              });
              warningCount++;
            }
          }
        }
        return { success: true, warnings: warningCount, escalations: escalationCount };
      } catch (e) {
        console.error(e);
        return { success: false, warnings: 0, escalations: 0 };
      }
    }

    const db = readDb();
    const pending = db.leaves.filter(l => ["Pending Supervisor Approval", "Pending Manager Approval", "Pending HR Approval", "Pending Approval"].includes(l.status));
    
    for (const req of pending) {
      const lastDate = req.firstActionAt || req.submittedAt || new Date().toISOString();
      const diffHours = (now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60);

      if (diffHours > 72) {
        const nextStep = (req.currentStep || 1) + 1;
        const totalSteps = req.totalSteps || 1;
        const previousStatus = req.status;
        let newStatus = req.status;

        if (nextStep <= totalSteps) {
          if (req.workflowId === "WF-ANNUAL") {
            newStatus = nextStep === 2 ? "Pending Manager Approval" : "Pending HR Approval";
          } else if (req.workflowId === "WF-SICK") {
            newStatus = "Pending HR Approval";
          }

          req.currentStep = nextStep;
          req.status = newStatus;
          req.escalationCount = (req.escalationCount || 0) + 1;

          db.leaveApprovalHistories = db.leaveApprovalHistories || [];
          db.leaveApprovalHistories.push({
            id: `HIST-${Date.now()}`,
            leaveRequestId: req.id,
            action: "ESCALATE",
            remarks: "Auto-escalated due to 72 hours inactivity at current level",
            previousStatus: previousStatus,
            newStatus,
            createdAt: new Date().toISOString()
          });
          escalationCount++;
        }
      } else if (diffHours > 24 && (req.escalationCount || 0) === 0) {
        const warningExists = db.leaveApprovalHistories?.some(h => h.leaveRequestId === req.id && h.action === "ESCALATE" && h.remarks?.startsWith("SLA Warning"));
        if (!warningExists) {
          db.leaveApprovalHistories = db.leaveApprovalHistories || [];
          db.leaveApprovalHistories.push({
            id: `HIST-${Date.now()}`,
            leaveRequestId: req.id,
            action: "ESCALATE",
            remarks: "SLA Warning: Pending for more than 24 hours.",
            previousStatus: req.status,
            newStatus: req.status,
            createdAt: new Date().toISOString()
          });
          warningCount++;
        }
      }
    }

    writeDb(db);
    return { success: true, warnings: warningCount, escalations: escalationCount };
  },
  
  // SAP Mappings
  getSapMappings: async (): Promise<SapMapping[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapMapping.findMany();
    }
    return readDb().sapMappings;
  },
  updateSapMappingStatus: async (id: string, status: SapMapping["status"]): Promise<SapMapping | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const mapping = await prismaClient.sapMapping.update({
          where: { id },
          data: { status }
        });
        return mapping;
      } catch (e) {
        return null;
      }
    }

    const db = readDb();
    const mapping = db.sapMappings.find(m => m.id === id);
    if (!mapping) return null;
    mapping.status = status;
    writeDb(db);
    return mapping;
  },
  
  // Sync Logs
  getSyncLogs: async (): Promise<SyncLog[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const logs = await prismaClient.syncLog.findMany({
        orderBy: { timestamp: "desc" }
      });
      return logs.map(mapSyncLog);
    }
    return readDb().syncLogs;
  },
  addSyncLog: async (log: Omit<SyncLog, "id" | "timestamp">): Promise<SyncLog> => {
    if (isDbConnected()) {
      await seedMySQL();
      const newLog = await prismaClient.syncLog.create({
        data: {
          ...log,
          timestamp: new Date()
        }
      });
      return mapSyncLog(newLog);
    }

    const db = readDb();
    const newLog: SyncLog = {
      ...log,
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19)
    };
    db.syncLogs.unshift(newLog);
    writeDb(db);
    return newLog;
  },
  
  // Announcements
  getAnnouncements: async (): Promise<Announcement[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const announcements = await prismaClient.announcement.findMany({
        orderBy: { timestamp: "desc" }
      });
      return announcements.map(mapAnnouncement);
    }
    return readDb().announcements;
  },

  // Departments CRUD
  getDepartments: async (): Promise<Department[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const departments = await prismaClient.department.findMany({
        orderBy: { name: "asc" }
      });
      return departments.map((d: any) => ({
        id: d.id,
        name: d.name,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString()
      }));
    }
    const db = readDb();
    if (!db.departments) {
      db.departments = [
        { id: "DEPT-001", name: "Operations", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "DEPT-002", name: "Engineering", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "DEPT-003", name: "Logistics", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "DEPT-004", name: "Sales", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: "DEPT-005", name: "IT", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ];
      writeDb(db);
    }
    return db.departments;
  },
  createDepartment: async (name: string): Promise<Department> => {
    if (isDbConnected()) {
      await seedMySQL();
      const dept = await prismaClient.department.create({
        data: { name }
      });
      return {
        id: dept.id,
        name: dept.name,
        createdAt: dept.createdAt.toISOString(),
        updatedAt: dept.updatedAt.toISOString()
      };
    }
    const db = readDb();
    if (!db.departments) db.departments = [];
    const newDept: Department = {
      id: `DEPT-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.departments.push(newDept);
    writeDb(db);
    return newDept;
  },
  updateDepartment: async (id: string, name: string): Promise<Department | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const dept = await prismaClient.department.update({
          where: { id },
          data: { name }
        });
        return {
          id: dept.id,
          name: dept.name,
          createdAt: dept.createdAt.toISOString(),
          updatedAt: dept.updatedAt.toISOString()
        };
      } catch (e) {
        return null;
      }
    }
    const db = readDb();
    if (!db.departments) db.departments = [];
    const dept = db.departments.find(d => d.id === id);
    if (!dept) return null;
    dept.name = name;
    dept.updatedAt = new Date().toISOString();
    writeDb(db);
    return dept;
  },

  // Employees Extended CRUD
  createEmployee: async (data: Omit<Employee, "passwordHash"> & { password?: string }): Promise<Employee> => {
    const passwordHash = data.password ? bcrypt.hashSync(data.password, 10) : defaultHash;
    const { password, ...empData } = data;
    
    // Auto-resolve department name for compatibility string
    let departmentName = empData.department;
    if (empData.departmentId) {
      const depts = await mockDb.getDepartments();
      const matched = depts.find(d => d.id === empData.departmentId);
      if (matched) {
        departmentName = matched.name;
      }
    }

    const payload = {
      ...empData,
      department: departmentName,
      passwordHash,
      isActive: true
    };

    if (isDbConnected()) {
      await seedMySQL();
      const emp = await prismaClient.employee.create({
        data: payload
      });
      return emp;
    }

    const db = readDb();
    db.employees.push(payload);
    writeDb(db);
    return payload;
  },
  updateEmployee: async (id: string, data: Partial<Employee>): Promise<Employee | null> => {
    let departmentName = data.department;
    if (data.departmentId && !departmentName) {
      const depts = await mockDb.getDepartments();
      const matched = depts.find(d => d.id === data.departmentId);
      if (matched) {
        departmentName = matched.name;
      }
    }

    const payload = {
      ...data,
      ...(departmentName ? { department: departmentName } : {})
    };

    if (isDbConnected()) {
      await seedMySQL();
      try {
        const emp = await prismaClient.employee.update({
          where: { id },
          data: payload as any
        });
        return emp;
      } catch (e) {
        return null;
      }
    }

    const db = readDb();
    const employee = db.employees.find(e => e.id === id);
    if (!employee) return null;
    Object.assign(employee, payload);
    writeDb(db);
    return employee;
  },
  deactivateEmployee: async (id: string): Promise<Employee | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const emp = await prismaClient.employee.update({
          where: { id },
          data: { isActive: false }
        });
        return emp;
      } catch (e) {
        return null;
      }
    }

    const db = readDb();
    const employee = db.employees.find(e => e.id === id);
    if (!employee) return null;
    employee.isActive = false;
    writeDb(db);
    return employee;
  },

  // Worksites CRUD
  getWorksites: async (): Promise<Worksite[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const worksites = await prismaClient.worksite.findMany({
        orderBy: { name: "asc" }
      });
      return worksites.map(mapWorksite);
    }
    return readDb().worksites;
  },
  createWorksite: async (name: string, lat: number, lng: number, radiusMeters: number): Promise<Worksite> => {
    if (isDbConnected()) {
      await seedMySQL();
      const site = await prismaClient.worksite.create({
        data: { name, lat, lng, radiusMeters, isActive: true }
      });
      return mapWorksite(site);
    }
    const db = readDb();
    const newSite: Worksite = {
      id: `WORK-${Date.now()}`,
      name,
      lat,
      lng,
      radiusMeters,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.worksites.push(newSite);
    writeDb(db);
    return newSite;
  },
  updateWorksite: async (id: string, data: Partial<Worksite>): Promise<Worksite | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const site = await prismaClient.worksite.update({
          where: { id },
          data
        });
        return mapWorksite(site);
      } catch (e) {
        return null;
      }
    }
    const db = readDb();
    const site = db.worksites.find(s => s.id === id);
    if (!site) return null;
    Object.assign(site, data);
    site.updatedAt = new Date().toISOString();
    writeDb(db);
    return site;
  },

  // Corrections CRUD
  getCorrections: async (): Promise<AttendanceCorrection[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const corrections = await prismaClient.attendanceCorrection.findMany({
        orderBy: { createdAt: "desc" }
      });
      return corrections.map(mapCorrection);
    }
    return readDb().attendanceCorrections;
  },
  submitCorrection: async (attendanceRecordId: string, requestedCheckIn: string | undefined, requestedCheckOut: string | undefined, reason: string): Promise<AttendanceCorrection> => {
    if (isDbConnected()) {
      await seedMySQL();
      const correction = await prismaClient.attendanceCorrection.create({
        data: {
          attendanceRecordId,
          requestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : null,
          requestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : null,
          reason,
          status: "Pending"
        }
      });
      // Mark attendance record status as PENDING_CORRECTION
      await prismaClient.attendanceRecord.update({
        where: { id: attendanceRecordId },
        data: { status: "PENDING_CORRECTION" }
      });
      return mapCorrection(correction);
    }
    const db = readDb();
    const newCorrection: AttendanceCorrection = {
      id: `CORR-${Date.now()}`,
      attendanceRecordId,
      requestedCheckIn,
      requestedCheckOut,
      reason,
      status: "Pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.attendanceCorrections.unshift(newCorrection);
    
    // Mark fallback record
    const att = db.attendance.find(a => a.id === attendanceRecordId);
    if (att) {
      att.status = "PENDING_CORRECTION";
    }
    
    writeDb(db);
    return newCorrection;
  },
  reviewCorrection: async (id: string, status: "Approved" | "Rejected", reviewedById: string | undefined, reviewNotes: string | undefined): Promise<AttendanceCorrection | null> => {
    if (isDbConnected()) {
      await seedMySQL();
      try {
        const correction = await prismaClient.attendanceCorrection.update({
          where: { id },
          data: { status, reviewedById, reviewNotes }
        });

        const attRecord = await prismaClient.attendanceRecord.findUnique({
          where: { id: correction.attendanceRecordId }
        });

        if (attRecord) {
          if (status === "Approved") {
            const checkInVal = correction.requestedCheckIn || attRecord.checkIn;
            const checkOutVal = correction.requestedCheckOut || attRecord.checkOut;

            // Recalculate late minutes
            let lateMinutes = attRecord.lateMinutes;
            let finalStatus = "CORRECTED";

            if (attRecord.shiftId) {
              const shift = await prismaClient.shift.findUnique({ where: { id: attRecord.shiftId } });
              if (shift) {
                const expectedStart = getShiftStartTimeToday(shift.timeRange);
                if (expectedStart) {
                  const checkInTime = new Date(checkInVal);
                  const diffMs = checkInTime.getTime() - expectedStart.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  lateMinutes = diffMins > 5 ? diffMins : 0;
                }
              }
            }

            await prismaClient.attendanceRecord.update({
              where: { id: attRecord.id },
              data: {
                checkIn: checkInVal,
                checkOut: checkOutVal,
                status: finalStatus,
                lateMinutes
              }
            });
          } else {
            // Revert PENDING_CORRECTION back to its proper status based on original details
            let originalStatus = "ON_TIME";
            if (attRecord.shiftId) {
              const shift = await prismaClient.shift.findUnique({ where: { id: attRecord.shiftId } });
              if (shift) {
                const expectedStart = getShiftStartTimeToday(shift.timeRange);
                if (expectedStart) {
                  const checkInTime = new Date(attRecord.originalCheckIn);
                  const diffMs = checkInTime.getTime() - expectedStart.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  if (diffMins > 5) {
                    originalStatus = "LATE";
                  }
                }
              }
            }
            // Check if originally it was out of zone
            if (attRecord.worksiteId === null) {
              originalStatus = "OUT_OF_ZONE";
            }
            await prismaClient.attendanceRecord.update({
              where: { id: attRecord.id },
              data: { status: originalStatus }
            });
          }
        }

        return mapCorrection(correction);
      } catch (e) {
        return null;
      }
    }

    const db = readDb();
    const correction = db.attendanceCorrections.find(c => c.id === id);
    if (!correction) return null;
    correction.status = status;
    correction.reviewedById = reviewedById;
    correction.reviewNotes = reviewNotes;
    correction.updatedAt = new Date().toISOString();

    const attRecord = db.attendance.find(a => a.id === correction.attendanceRecordId);
    if (attRecord) {
      if (status === "Approved") {
        attRecord.checkIn = correction.requestedCheckIn ? correction.requestedCheckIn : attRecord.checkIn;
        attRecord.checkOut = correction.requestedCheckOut ? correction.requestedCheckOut : attRecord.checkOut;
        attRecord.status = "CORRECTED";

        if (attRecord.shiftId) {
          const shift = db.shifts.find(s => s.id === attRecord.shiftId);
          if (shift) {
            const expectedStart = getShiftStartTimeToday(shift.timeRange);
            if (expectedStart) {
              const checkInTime = new Date(attRecord.checkIn);
              const diffMs = checkInTime.getTime() - expectedStart.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              attRecord.lateMinutes = diffMins > 5 ? diffMins : 0;
            }
          }
        }
      } else {
        let originalStatus = "ON_TIME";
        if (attRecord.shiftId) {
          const shift = db.shifts.find(s => s.id === attRecord.shiftId);
          if (shift) {
            const expectedStart = getShiftStartTimeToday(shift.timeRange);
            if (expectedStart) {
              const checkInTime = new Date(attRecord.originalCheckIn);
              const diffMs = checkInTime.getTime() - expectedStart.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              if (diffMins > 5) {
                originalStatus = "LATE";
              }
            }
          }
        }
        if (!attRecord.worksiteId) {
          originalStatus = "OUT_OF_ZONE";
        }
        attRecord.status = originalStatus;
      }
    }

    writeDb(db);
    return correction;
  },

  // Phase 4A Scheduling & Rotations Methods
  getShiftTemplates: async (): Promise<ShiftTemplate[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.shiftTemplate.findMany();
      return records.map((r: any) => ({
        id: r.id,
        name: r.name,
        startTime: r.startTime,
        endTime: r.endTime,
        isSplit: r.isSplit,
        splitStart: r.splitStart || undefined,
        splitEnd: r.splitEnd || undefined,
        isFlexible: r.isFlexible,
        coreHours: r.coreHours || undefined,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      }));
    }
    return readDb().shiftTemplates || [];
  },

  createShiftTemplate: async (name: string, startTime: string, endTime: string, isSplit?: boolean, splitStart?: string, splitEnd?: string, isFlexible?: boolean, coreHours?: number): Promise<ShiftTemplate> => {
    const actualIsSplit = !!isSplit;
    const actualIsFlexible = !!isFlexible;
    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.shiftTemplate.create({
        data: {
          name,
          startTime,
          endTime,
          isSplit: actualIsSplit,
          splitStart: splitStart || null,
          splitEnd: splitEnd || null,
          isFlexible: actualIsFlexible,
          coreHours: coreHours || null
        }
      });
      return {
        id: record.id,
        name: record.name,
        startTime: record.startTime,
        endTime: record.endTime,
        isSplit: record.isSplit,
        splitStart: record.splitStart || undefined,
        splitEnd: record.splitEnd || undefined,
        isFlexible: record.isFlexible,
        coreHours: record.coreHours || undefined,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      };
    }

    const db = readDb();
    const newTemplate: ShiftTemplate = {
      id: `WF-SH-${Date.now()}`,
      name,
      startTime,
      endTime,
      isSplit: actualIsSplit,
      splitStart,
      splitEnd,
      isFlexible: actualIsFlexible,
      coreHours,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.shiftTemplates = db.shiftTemplates || [];
    db.shiftTemplates.push(newTemplate);
    writeDb(db);
    return newTemplate;
  },

  getRotationTemplates: async (): Promise<RotationTemplate[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.rotationTemplate.findMany();
      return records.map((r: any) => ({
        id: r.id,
        name: r.name,
        cycleDays: r.cycleDays,
        patternJson: r.patternJson,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      }));
    }
    return readDb().rotationTemplates || [];
  },

  createRotationTemplate: async (name: string, cycleDays: number, patternJson: string): Promise<RotationTemplate> => {
    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.rotationTemplate.create({
        data: { name, cycleDays, patternJson }
      });
      return {
        id: record.id,
        name: record.name,
        cycleDays: record.cycleDays,
        patternJson: record.patternJson,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      };
    }

    const db = readDb();
    const newTemplate: RotationTemplate = {
      id: `ROT-${Date.now()}`,
      name,
      cycleDays,
      patternJson,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.rotationTemplates = db.rotationTemplates || [];
    db.rotationTemplates.push(newTemplate);
    writeDb(db);
    return newTemplate;
  },

  getShiftAssignments: async (): Promise<ShiftAssignment[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.shiftAssignment.findMany({
        include: { shiftTemplate: true }
      });
      
      const employees = await prismaClient.employee.findMany();

      return records.map((r: any) => {
        const emp = employees.find((e: any) => e.id === r.employeeId);
        return {
          id: r.id,
          employeeId: r.employeeId,
          employeeName: emp ? emp.name : "Unknown",
          shiftTemplateId: r.shiftTemplateId,
          shiftTemplate: {
            id: r.shiftTemplate.id,
            name: r.shiftTemplate.name,
            startTime: r.shiftTemplate.startTime,
            endTime: r.shiftTemplate.endTime,
            isSplit: r.shiftTemplate.isSplit,
            splitStart: r.shiftTemplate.splitStart || undefined,
            splitEnd: r.shiftTemplate.splitEnd || undefined,
            isFlexible: r.shiftTemplate.isFlexible,
            coreHours: r.shiftTemplate.coreHours || undefined
          },
          date: r.date.toISOString().substring(0, 10),
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString()
        };
      });
    }

    const db = readDb();
    db.shiftAssignments = db.shiftAssignments || [];
    return db.shiftAssignments.map(sa => {
      const emp = db.employees.find(e => e.id === sa.employeeId);
      const st = db.shiftTemplates?.find(t => t.id === sa.shiftTemplateId);
      return {
        ...sa,
        employeeName: emp ? emp.name : "Unknown",
        shiftTemplate: st
      };
    });
  },

  checkAssignmentConflicts: async (employeeId: string, dateStr: string): Promise<string[]> => {
    const conflicts: string[] = [];
    
    // 1. Inactive employee check
    const employees = await mockDb.getEmployees();
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) {
      conflicts.push("Employee not found");
      return conflicts;
    }
    if (emp.isActive === false) {
      conflicts.push(`Employee ${emp.name} (${employeeId}) is inactive`);
    }

    // 2. Overlapping shift checks (on same date)
    const assignments = await mockDb.getShiftAssignments();
    const hasOverlap = assignments.some(a => a.employeeId === employeeId && a.date === dateStr);
    if (hasOverlap) {
      conflicts.push(`Employee ${emp.name} already has a shift assigned on ${dateStr}`);
    }

    // 3. Approved leave checks
    const leaves = await mockDb.getLeaves();
    const onLeave = leaves.some(l => {
      if (l.employeeId !== employeeId || l.status !== "Approved") return false;
      if (!l.startDate || !l.endDate) return false;
      
      const checkDate = new Date(dateStr);
      const startDate = new Date(l.startDate);
      const endDate = new Date(l.endDate);
      
      checkDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      return checkDate >= startDate && checkDate <= endDate;
    });
    if (onLeave) {
      conflicts.push(`Employee ${emp.name} is on approved leave on ${dateStr}`);
    }

    return conflicts;
  },

  createShiftAssignment: async (employeeId: string, shiftTemplateId: string, dateStr: string): Promise<{ success: boolean; assignment?: ShiftAssignment; errors?: string[] }> => {
    const conflicts = await mockDb.checkAssignmentConflicts(employeeId, dateStr);
    if (conflicts.length > 0) {
      return { success: false, errors: conflicts };
    }

    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.shiftAssignment.create({
        data: {
          employeeId,
          shiftTemplateId,
          date: new Date(dateStr)
        },
        include: { shiftTemplate: true }
      });
      return {
        success: true,
        assignment: {
          id: record.id,
          employeeId: record.employeeId,
          shiftTemplateId: record.shiftTemplateId,
          date: record.date.toISOString().substring(0, 10),
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        }
      };
    }

    const db = readDb();
    const newAssignment: ShiftAssignment = {
      id: `ASSIGN-${Date.now()}`,
      employeeId,
      shiftTemplateId,
      date: dateStr,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.shiftAssignments = db.shiftAssignments || [];
    db.shiftAssignments.push(newAssignment);
    writeDb(db);

    return {
      success: true,
      assignment: newAssignment
    };
  },

  createBulkShiftAssignments: async (employeeIds: string[], shiftTemplateId: string, dates: string[]): Promise<{ success: boolean; createdCount: number; errors?: string[] }> => {
    const allErrors: string[] = [];
    
    // Check conflicts for all employee-date combinations
    for (const empId of employeeIds) {
      for (const d of dates) {
        const conflicts = await mockDb.checkAssignmentConflicts(empId, d);
        if (conflicts.length > 0) {
          allErrors.push(...conflicts);
        }
      }
    }

    if (allErrors.length > 0) {
      return { success: false, createdCount: 0, errors: allErrors };
    }

    let count = 0;
    if (isDbConnected()) {
      await seedMySQL();
      for (const empId of employeeIds) {
        for (const d of dates) {
          await prismaClient.shiftAssignment.create({
            data: {
              employeeId: empId,
              shiftTemplateId,
              date: new Date(d)
            }
          });
          count++;
        }
      }
    } else {
      const db = readDb();
      db.shiftAssignments = db.shiftAssignments || [];
      for (const empId of employeeIds) {
        for (const d of dates) {
          db.shiftAssignments.push({
            id: `ASSIGN-${Date.now()}-${count}`,
            employeeId: empId,
            shiftTemplateId,
            date: d,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          count++;
        }
      }
      writeDb(db);
    }

    return { success: true, createdCount: count };
  },

  applyRotationAssignments: async (employeeIds: string[], rotationTemplateId: string, startDateStr: string, occurrences: number): Promise<{ success: boolean; createdCount: number; conflicts: Array<{ employeeId: string; date: string; reasons: string[] }> }> => {
    const db = readDb();
    
    // Find rotation template
    const rt = (isDbConnected()) 
      ? await prismaClient.rotationTemplate.findUnique({ where: { id: rotationTemplateId } })
      : db.rotationTemplates?.find(r => r.id === rotationTemplateId);
      
    if (!rt) {
      return { success: false, createdCount: 0, conflicts: [{ employeeId: "ALL", date: "ALL", reasons: ["Rotation template not found"] }] };
    }

    const pattern: string[] = JSON.parse(rt.patternJson);
    const conflictsList: Array<{ employeeId: string; date: string; reasons: string[] }> = [];
    const assignmentsToWrite: Array<{ employeeId: string; shiftTemplateId: string; date: string }> = [];

    // Calculate dates and check conflicts
    for (const empId of employeeIds) {
      const start = new Date(startDateStr);
      for (let i = 0; i < occurrences; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        const dateStr = currentDate.toISOString().substring(0, 10);
        
        const patternIndex = i % pattern.length;
        const shiftTemplateId = pattern[patternIndex];

        if (shiftTemplateId !== "REST") {
          // Check conflicts
          const conflicts = await mockDb.checkAssignmentConflicts(empId, dateStr);
          if (conflicts.length > 0) {
            conflictsList.push({
              employeeId: empId,
              date: dateStr,
              reasons: conflicts
            });
          } else {
            assignmentsToWrite.push({
              employeeId: empId,
              shiftTemplateId,
              date: dateStr
            });
          }
        }
      }
    }

    // Report conflicts instead of silently writing if any exist
    if (conflictsList.length > 0) {
      return { success: false, createdCount: 0, conflicts: conflictsList };
    }

    // Write all assignments
    let count = 0;
    if (isDbConnected()) {
      await seedMySQL();
      for (const sa of assignmentsToWrite) {
        await prismaClient.shiftAssignment.create({
          data: {
            employeeId: sa.employeeId,
            shiftTemplateId: sa.shiftTemplateId,
            date: new Date(sa.date)
          }
        });
        count++;
      }
    } else {
      db.shiftAssignments = db.shiftAssignments || [];
      for (const sa of assignmentsToWrite) {
        db.shiftAssignments.push({
          id: `ASSIGN-${Date.now()}-${count}`,
          employeeId: sa.employeeId,
          shiftTemplateId: sa.shiftTemplateId,
          date: sa.date,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        count++;
      }
      writeDb(db);
    }

    return { success: true, createdCount: count, conflicts: [] };
  },

  getOvertimeRates: async (): Promise<OvertimeRate[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.overtimeRate.findMany();
      return records.map((r: any) => ({
        id: r.id,
        name: r.name,
        overtimeType: r.overtimeType,
        multiplier: r.multiplier,
        fixedRateAmount: r.fixedRateAmount || undefined,
        currency: r.currency,
        appliesOnWeekend: r.appliesOnWeekend,
        appliesOnHoliday: r.appliesOnHoliday,
        appliesAfterMinutes: r.appliesAfterMinutes,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString()
      }));
    }
    const db = readDb();
    return db.overtimeRates || [];
  },

  createOvertimeRate: async (name: string, overtimeType: string, multiplier: number, fixedRateAmount?: number, currency = "QAR", appliesOnWeekend = false, appliesOnHoliday = false, appliesAfterMinutes = 0, isActive = true): Promise<OvertimeRate> => {
    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.overtimeRate.create({
        data: {
          name,
          overtimeType,
          multiplier,
          fixedRateAmount: fixedRateAmount || null,
          currency,
          appliesOnWeekend,
          appliesOnHoliday,
          appliesAfterMinutes,
          isActive
        }
      });
      return {
        id: record.id,
        name: record.name,
        overtimeType: record.overtimeType,
        multiplier: record.multiplier,
        fixedRateAmount: record.fixedRateAmount || undefined,
        currency: record.currency,
        appliesOnWeekend: record.appliesOnWeekend,
        appliesOnHoliday: record.appliesOnHoliday,
        appliesAfterMinutes: record.appliesAfterMinutes,
        isActive: record.isActive,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      };
    }
    const db = readDb();
    const newRate: OvertimeRate = {
      id: `RATE-${Date.now()}`,
      name,
      overtimeType,
      multiplier,
      fixedRateAmount,
      currency,
      appliesOnWeekend,
      appliesOnHoliday,
      appliesAfterMinutes,
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.overtimeRates = db.overtimeRates || [];
    db.overtimeRates.push(newRate);
    writeDb(db);
    return newRate;
  },

  updateOvertimeRate: async (id: string, data: Partial<Omit<OvertimeRate, "id">>): Promise<OvertimeRate> => {
    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.overtimeRate.update({
        where: { id },
        data: {
          name: data.name,
          overtimeType: data.overtimeType,
          multiplier: data.multiplier,
          fixedRateAmount: data.fixedRateAmount !== undefined ? data.fixedRateAmount : undefined,
          currency: data.currency,
          appliesOnWeekend: data.appliesOnWeekend,
          appliesOnHoliday: data.appliesOnHoliday,
          appliesAfterMinutes: data.appliesAfterMinutes,
          isActive: data.isActive
        }
      });
      return {
        id: record.id,
        name: record.name,
        overtimeType: record.overtimeType,
        multiplier: record.multiplier,
        fixedRateAmount: record.fixedRateAmount || undefined,
        currency: record.currency,
        appliesOnWeekend: record.appliesOnWeekend,
        appliesOnHoliday: record.appliesOnHoliday,
        appliesAfterMinutes: record.appliesAfterMinutes,
        isActive: record.isActive,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      };
    }
    const db = readDb();
    db.overtimeRates = db.overtimeRates || [];
    const index = db.overtimeRates.findIndex(r => r.id === id);
    if (index === -1) throw new Error("Overtime rate not found");
    const updated = {
      ...db.overtimeRates[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    db.overtimeRates[index] = updated;
    writeDb(db);
    return updated;
  },

  getShiftSwaps: async (): Promise<ShiftSwapRequest[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const records = await prismaClient.shiftSwapRequest.findMany();
      const employees = await prismaClient.employee.findMany();
      const templates = await prismaClient.shiftTemplate.findMany();
      return records.map((r: any) => {
        const reqEmp = employees.find((e: any) => e.id === r.requestorId);
        const tgtEmp = employees.find((e: any) => e.id === r.targetEmployeeId);
        const reqSt = templates.find((t: any) => t.id === r.requestorShiftId);
        const tgtSt = templates.find((t: any) => t.id === r.targetShiftId);
        return {
          id: r.id,
          requestorId: r.requestorId,
          requestorName: reqEmp ? reqEmp.name : "Unknown",
          targetEmployeeId: r.targetEmployeeId,
          targetEmployeeName: tgtEmp ? tgtEmp.name : "Unknown",
          requestorShiftId: r.requestorShiftId,
          requestorShiftName: reqSt ? reqSt.name : "Unknown",
          targetShiftId: r.targetShiftId,
          targetShiftName: tgtSt ? tgtSt.name : "Unknown",
          status: r.status,
          reason: r.reason || undefined,
          reviewNotes: r.reviewNotes || undefined,
          approvedById: r.approvedById || undefined,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString()
        };
      });
    }
    const db = readDb();
    db.shiftSwaps = db.shiftSwaps || [];
    return db.shiftSwaps.map(s => {
      const reqEmp = db.employees.find(e => e.id === s.requestorId);
      const tgtEmp = db.employees.find(e => e.id === s.targetEmployeeId);
      const reqSt = db.shiftTemplates?.find(t => t.id === s.requestorShiftId);
      const tgtSt = db.shiftTemplates?.find(t => t.id === s.targetShiftId);
      return {
        ...s,
        requestorName: reqEmp ? reqEmp.name : "Unknown",
        targetEmployeeName: tgtEmp ? tgtEmp.name : "Unknown",
        requestorShiftName: reqSt ? reqSt.name : "Unknown",
        targetShiftName: tgtSt ? tgtSt.name : "Unknown"
      };
    });
  },

  createShiftSwapRequest: async (requestorId: string, targetEmployeeId: string, requestorShiftId: string, targetShiftId: string, reason?: string): Promise<ShiftSwapRequest> => {
    const employees = await mockDb.getEmployees();
    const reqEmp = employees.find(e => e.id === requestorId);
    const tgtEmp = employees.find(e => e.id === targetEmployeeId);
    if (!reqEmp || !tgtEmp) {
      throw new Error("One or both employees not found");
    }
    if (reqEmp.isActive === false || tgtEmp.isActive === false) {
      throw new Error("Cannot request shift swaps involving inactive employees");
    }

    const assignments = await mockDb.getShiftAssignments();
    const reqAsg = assignments.find(a => a.id === requestorShiftId);
    const tgtAsg = assignments.find(a => a.id === targetShiftId);
    if (!reqAsg || !tgtAsg) {
      throw new Error("One or both shift assignments not found");
    }

    const leaves = await mockDb.getLeaves();
    const reqLeaveConflict = leaves.some(l => l.employeeId === requestorId && l.status === "Approved" && l.startDate && l.endDate && tgtAsg.date >= l.startDate && tgtAsg.date <= l.endDate);
    if (reqLeaveConflict) {
      throw new Error(`Requestor has approved leave on target date ${tgtAsg.date}`);
    }

    const tgtLeaveConflict = leaves.some(l => l.employeeId === targetEmployeeId && l.status === "Approved" && l.startDate && l.endDate && reqAsg.date >= l.startDate && reqAsg.date <= l.endDate);
    if (tgtLeaveConflict) {
      throw new Error(`Target employee has approved leave on requestor date ${reqAsg.date}`);
    }

    if (isDbConnected()) {
      await seedMySQL();
      const record = await prismaClient.shiftSwapRequest.create({
        data: {
          requestorId,
          targetEmployeeId,
          requestorShiftId: reqAsg.shiftTemplateId,
          targetShiftId: tgtAsg.shiftTemplateId,
          status: "PENDING",
          reason: reason || null
        }
      });
      return {
        id: record.id,
        requestorId: record.requestorId,
        requestorName: reqEmp.name,
        targetEmployeeId: record.targetEmployeeId,
        targetEmployeeName: tgtEmp.name,
        requestorShiftId: record.requestorShiftId,
        targetShiftId: record.targetShiftId,
        status: record.status,
        reason: record.reason || undefined,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      };
    }

    const db = readDb();
    const newRequest: ShiftSwapRequest = {
      id: `SWAP-${Date.now()}`,
      requestorId,
      targetEmployeeId,
      requestorShiftId: reqAsg.shiftTemplateId,
      targetShiftId: tgtAsg.shiftTemplateId,
      status: "PENDING",
      reason,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.shiftSwaps = db.shiftSwaps || [];
    db.shiftSwaps.push(newRequest);
    writeDb(db);
    return newRequest;
  },

  actionShiftSwapRequest: async (swapId: string, status: "APPROVED" | "REJECTED", reviewNotes?: string, approvedById?: string): Promise<ShiftSwapRequest> => {
    if (isDbConnected()) {
      await seedMySQL();
      const request = await prismaClient.shiftSwapRequest.findUnique({ where: { id: swapId } });
      if (!request) throw new Error("Shift swap request not found");
      if (request.status !== "PENDING") throw new Error("Shift swap request is already processed");

      const updated = await prismaClient.shiftSwapRequest.update({
        where: { id: swapId },
        data: {
          status,
          reviewNotes: reviewNotes || null,
          approvedById: approvedById || null
        }
      });

      if (status === "APPROVED") {
        const reqAsg = await prismaClient.shiftAssignment.findFirst({
          where: { employeeId: request.requestorId, shiftTemplateId: request.requestorShiftId }
        });
        const tgtAsg = await prismaClient.shiftAssignment.findFirst({
          where: { employeeId: request.targetEmployeeId, shiftTemplateId: request.targetShiftId }
        });
        
        if (reqAsg && tgtAsg) {
          const reqEmpId = reqAsg.employeeId;
          const tgtEmpId = tgtAsg.employeeId;

          await prismaClient.shiftAssignment.update({
            where: { id: reqAsg.id },
            data: { employeeId: "TEMP_SWAP_HOLDER" }
          });
          await prismaClient.shiftAssignment.update({
            where: { id: tgtAsg.id },
            data: { employeeId: reqEmpId }
          });
          await prismaClient.shiftAssignment.update({
            where: { id: reqAsg.id },
            data: { employeeId: tgtEmpId }
          });
        }
      }

      return {
        id: updated.id,
        requestorId: updated.requestorId,
        targetEmployeeId: updated.targetEmployeeId,
        requestorShiftId: updated.requestorShiftId,
        targetShiftId: updated.targetShiftId,
        status: updated.status,
        reviewNotes: updated.reviewNotes || undefined,
        approvedById: updated.approvedById || undefined,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString()
      };
    }

    const db = readDb();
    const index = db.shiftSwaps.findIndex(s => s.id === swapId);
    if (index === -1) throw new Error("Shift swap request not found");
    const swap = db.shiftSwaps[index];
    if (swap.status !== "PENDING") throw new Error("Shift swap request is already processed");

    swap.status = status;
    swap.reviewNotes = reviewNotes;
    swap.approvedById = approvedById;
    swap.updatedAt = new Date().toISOString();

    if (status === "APPROVED") {
      const reqAsg = db.shiftAssignments.find(a => a.employeeId === swap.requestorId && a.shiftTemplateId === swap.requestorShiftId);
      const tgtAsg = db.shiftAssignments.find(a => a.employeeId === swap.targetEmployeeId && a.shiftTemplateId === swap.targetShiftId);
      if (reqAsg && tgtAsg) {
        const temp = reqAsg.employeeId;
        reqAsg.employeeId = tgtAsg.employeeId;
        tgtAsg.employeeId = temp;
      }
    }

    writeDb(db);
    return swap;
  },

  getShiftCoverage: async (): Promise<any[]> => {
    const assignments = await mockDb.getShiftAssignments();
    const templates = await mockDb.getShiftTemplates();
    
    const groups: { [key: string]: number } = {};
    for (const sa of assignments) {
      const key = `${sa.date}_${sa.shiftTemplateId}`;
      groups[key] = (groups[key] || 0) + 1;
    }

    const getTarget = (templateId: string): number => {
      if (templateId.includes("MORN")) return 3;
      if (templateId.includes("EVE")) return 2;
      if (templateId.includes("NIGHT")) return 1;
      if (templateId.includes("SPLIT")) return 2;
      return 1;
    };

    const results: any[] = [];
    const start = new Date();
    for (let i = -2; i < 12; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().substring(0, 10);
      
      for (const t of templates) {
        const scheduled = groups[`${dateStr}_${t.id}`] || 0;
        const required = getTarget(t.id);
        let status = "OPTIMIZED";
        if (scheduled < required) status = "UNDERSTAFFED";
        if (scheduled > required) status = "OVERSTAFFED";

        results.push({
          date: dateStr,
          shiftTemplateId: t.id,
          shiftTemplateName: t.name,
          scheduled,
          required,
          status
        });
      }
    }
    return results;
  },

  getOvertimeRecords: async (): Promise<AttendanceRecord[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      const atts = await prismaClient.attendanceRecord.findMany({
        where: { NOT: { otStatus: "PENDING" } }
      });
      return atts.map(mapAttendance);
    }
    const db = readDb();
    return (db.attendance || []).map(mapAttendance);
  },

  actionOvertimeRecord: async (recordId: string, status: "APPROVED" | "REJECTED", approvedMinutes?: number, reviewNotes?: string): Promise<AttendanceRecord> => {
    if (isDbConnected()) {
      await seedMySQL();
      const rec = await prismaClient.attendanceRecord.findUnique({ where: { id: recordId } });
      if (!rec) throw new Error("Attendance record not found");
      if (rec.checkOut === null) throw new Error("Cannot action overtime for incomplete attendance record");
      
      const updated = await prismaClient.attendanceRecord.update({
        where: { id: recordId },
        data: {
          otStatus: status,
          otApprovedMinutes: status === "APPROVED" ? (approvedMinutes !== undefined ? approvedMinutes : (rec.standardOtMinutes + rec.weekendOtMinutes + rec.holidayOtMinutes + rec.nightOtMinutes + rec.specialEventOtMinutes)) : 0
        }
      });
      return mapAttendance(updated);
    }

    const db = readDb();
    const index = db.attendance.findIndex(r => r.id === recordId);
    if (index === -1) throw new Error("Attendance record not found");
    const rec = db.attendance[index];
    if (!rec.checkOut) throw new Error("Cannot action overtime for incomplete attendance record");

    rec.otStatus = status;
    const totalCalcMinutes = (rec.standardOtMinutes || 0) + (rec.weekendOtMinutes || 0) + (rec.holidayOtMinutes || 0) + (rec.nightOtMinutes || 0) + (rec.specialEventOtMinutes || 0);
    rec.otApprovedMinutes = status === "APPROVED" ? (approvedMinutes !== undefined ? approvedMinutes : totalCalcMinutes) : 0;
    
    writeDb(db);
    return mapAttendance(rec);
  },

  // SAP Connections
  getSapConnections: async (): Promise<SapConnection[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapConnection.findMany();
    }
    const db = readDb();
    return db.sapConnections || [];
  },

  createSapConnection: async (data: any): Promise<SapConnection> => {
    const id = data.id || `CONN-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const newConn = {
      ...data,
      id,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapConnection.create({ data: newConn });
    }

    const db = readDb();
    db.sapConnections = db.sapConnections || [];
    db.sapConnections.push(newConn);
    writeDb(db);
    return newConn;
  },

  // SAP Sync Jobs
  getSapSyncJobs: async (): Promise<SapSyncJob[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapSyncJob.findMany({
        orderBy: { startedAt: "desc" }
      });
    }
    const db = readDb();
    return (db.sapSyncJobs || []).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  },

  createSapSyncJob: async (data: any): Promise<SapSyncJob> => {
    const id = data.id || `JOB-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const newJob = {
      ...data,
      id,
      recordsProcessed: data.recordsProcessed || 0,
      recordsSucceeded: data.recordsSucceeded || 0,
      recordsFailed: data.recordsFailed || 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      errorMessage: null,
      deltaToken: data.deltaToken || null
    };

    if (isDbConnected()) {
      await seedMySQL();
      const job = await prismaClient.sapSyncJob.create({
        data: {
          ...newJob,
          startedAt: new Date(newJob.startedAt)
        }
      });
      return {
        ...job,
        startedAt: job.startedAt.toISOString(),
        completedAt: job.completedAt ? job.completedAt.toISOString() : undefined
      };
    }

    const db = readDb();
    db.sapSyncJobs = db.sapSyncJobs || [];
    db.sapSyncJobs.push(newJob);
    writeDb(db);
    return newJob;
  },

  updateSapSyncJob: async (id: string, data: any): Promise<SapSyncJob> => {
    if (isDbConnected()) {
      await seedMySQL();
      const updateData: any = { ...data };
      if (data.startedAt) updateData.startedAt = new Date(data.startedAt);
      if (data.completedAt) updateData.completedAt = new Date(data.completedAt);

      const job = await prismaClient.sapSyncJob.update({
        where: { id },
        data: updateData
      });
      return {
        ...job,
        startedAt: job.startedAt.toISOString(),
        completedAt: job.completedAt ? job.completedAt.toISOString() : undefined
      };
    }

    const db = readDb();
    const index = db.sapSyncJobs.findIndex(j => j.id === id);
    if (index === -1) throw new Error("Sync job not found");
    db.sapSyncJobs[index] = {
      ...db.sapSyncJobs[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    writeDb(db);
    return db.sapSyncJobs[index];
  },

  // SAP Sync Logs
  getSapSyncLogs: async (jobId?: string): Promise<SapSyncLog[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapSyncLog.findMany({
        where: jobId ? { jobId } : undefined,
        orderBy: { createdAt: "desc" }
      });
    }
    const db = readDb();
    let logs = db.sapSyncLogs || [];
    if (jobId) {
      logs = logs.filter(l => l.jobId === jobId);
    }
    return logs;
  },

  createSapSyncLog: async (data: any): Promise<SapSyncLog> => {
    const id = data.id || `SLOG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const newLog = {
      ...data,
      id,
      createdAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      await seedMySQL();
      const log = await prismaClient.sapSyncLog.create({
        data: {
          ...newLog,
          createdAt: new Date(newLog.createdAt)
        }
      });
      return {
        ...log,
        createdAt: log.createdAt.toISOString()
      };
    }

    const db = readDb();
    db.sapSyncLogs = db.sapSyncLogs || [];
    db.sapSyncLogs.push(newLog);
    writeDb(db);
    return newLog;
  },

  // SAP Field Mappings
  getSapFieldMappings: async (): Promise<SapFieldMapping[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapFieldMapping.findMany();
    }
    const db = readDb();
    return db.sapFieldMappings || [];
  },

  createSapFieldMapping: async (data: any): Promise<SapFieldMapping> => {
    const id = data.id || `FMAP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const newMapping = {
      ...data,
      id,
      isRequired: data.isRequired || false,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapFieldMapping.create({ data: newMapping });
    }

    const db = readDb();
    db.sapFieldMappings = db.sapFieldMappings || [];
    db.sapFieldMappings.push(newMapping);
    writeDb(db);
    return newMapping;
  },

  updateSapFieldMapping: async (id: string, data: any): Promise<SapFieldMapping> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapFieldMapping.update({
        where: { id },
        data: {
          ...data,
          updatedAt: new Date()
        }
      });
    }

    const db = readDb();
    const index = db.sapFieldMappings.findIndex(m => m.id === id);
    if (index === -1) throw new Error("Field mapping not found");
    db.sapFieldMappings[index] = {
      ...db.sapFieldMappings[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    writeDb(db);
    return db.sapFieldMappings[index];
  },

  // SAP Retry Queue
  getSapRetryQueue: async (): Promise<SapRetryQueue[]> => {
    if (isDbConnected()) {
      await seedMySQL();
      return await prismaClient.sapRetryQueue.findMany({
        orderBy: { createdAt: "desc" }
      });
    }
    const db = readDb();
    return db.sapRetryQueues || [];
  },

  createSapRetryQueueItem: async (data: any): Promise<SapRetryQueue> => {
    const id = data.id || `RQ-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const newItem = {
      ...data,
      id,
      retryCount: data.retryCount || 0,
      status: data.status || "PENDING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (isDbConnected()) {
      await seedMySQL();
      const queue = await prismaClient.sapRetryQueue.create({
        data: {
          ...newItem,
          nextAttemptAt: new Date(newItem.nextAttemptAt)
        }
      });
      return {
        ...queue,
        nextAttemptAt: queue.nextAttemptAt.toISOString()
      };
    }

    const db = readDb();
    db.sapRetryQueues = db.sapRetryQueues || [];
    db.sapRetryQueues.push(newItem);
    writeDb(db);
    return newItem;
  },

  updateSapRetryQueueItem: async (id: string, data: any): Promise<SapRetryQueue> => {
    if (isDbConnected()) {
      await seedMySQL();
      const updateData: any = { ...data };
      if (data.nextAttemptAt) updateData.nextAttemptAt = new Date(data.nextAttemptAt);

      const queue = await prismaClient.sapRetryQueue.update({
        where: { id },
        data: updateData
      });
      return {
        ...queue,
        nextAttemptAt: queue.nextAttemptAt.toISOString()
      };
    }

    const db = readDb();
    const index = db.sapRetryQueues.findIndex(rq => rq.id === id);
    if (index === -1) throw new Error("Retry queue item not found");
    db.sapRetryQueues[index] = {
      ...db.sapRetryQueues[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    writeDb(db);
    return db.sapRetryQueues[index];
  },

  // Mock Engine for SAP Integration Sync
  triggerSapSync: async (connectionId: string, module: string, syncType: string): Promise<SapSyncJob> => {
    // 1. Create a sync job in processing status
    const job = await mockDb.createSapSyncJob({
      connectionId,
      module,
      syncType,
      status: "PROCESSING"
    });

    try {
      // Create trace connection verification logs
      await mockDb.createSapSyncLog({
        jobId: job.id,
        severity: "INFO",
        message: "Initiating connection to SAP SuccessFactors endpoint... OAuth SAML flow validation skipped in mock."
      });

      if (module === "EMPLOYEE") {
        await mockDb.createSapSyncLog({
          jobId: job.id,
          severity: "INFO",
          message: "Syncing Organization Structure (Departments, Cost Centers, Locations)..."
        });

        // Org mock upserts:
        // Seeding Department "HR" and Cost Center mappings
        const hrDept = { id: "DEPT-006", name: "Human Resources", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        if (isDbConnected()) {
          const exists = await prismaClient.department.findUnique({ where: { id: "DEPT-006" } });
          if (!exists) {
            await prismaClient.department.create({ data: hrDept });
          }
        } else {
          const db = readDb();
          if (!db.departments.some(d => d.id === "DEPT-006")) {
            db.departments.push(hrDept);
            writeDb(db);
          }
        }
        await mockDb.createSapSyncLog({
          jobId: job.id,
          severity: "INFO",
          message: `Upserted department HR (ID: DEPT-006) matching Cost Center CC-202 successfully.`,
          entityName: "Department",
          entityId: "DEPT-006"
        });

        // Upsert Location: Lusail Site geofence check
        await mockDb.createSapSyncLog({
          jobId: job.id,
          severity: "INFO",
          message: `Upserted worksite location Lusail Site (ID: WORK-002) matching SAP Location Code LOC-LUS.`,
          entityName: "Worksite",
          entityId: "WORK-002"
        });

        // 2. Perform Mock Employees Sync Inbound
        // Record 1: Ahmed Ali (existing) - updated
        await mockDb.createSapSyncLog({
          jobId: job.id,
          severity: "INFO",
          message: "Synchronizing employee AA-1001 (Ahmed Ali) - Active status confirmed.",
          entityName: "Employee",
          entityId: "AA-1001"
        });

        // Record 2: Ahmed Hassan (NEW) - created
        const newEmp: Employee = {
          id: "AH-2026",
          name: "Ahmed Hassan",
          department: "Operations",
          departmentId: "DEPT-001",
          role: "EMPLOYEE",
          status: "Offline",
          email: "ahmed.h@alhattab.qa",
          phone: "+974 5555 9999",
          shiftId: "GEN-001",
          passwordHash: defaultHash,
          isActive: true
        };
        if (isDbConnected()) {
          const exists = await prismaClient.employee.findUnique({ where: { id: "AH-2026" } });
          if (!exists) {
            await prismaClient.employee.create({ data: newEmp });
          }
        } else {
          const db = readDb();
          if (!db.employees.some(e => e.id === "AH-2026")) {
            db.employees.push(newEmp);
            writeDb(db);
          }
        }
        await mockDb.createSapSyncLog({
          jobId: job.id,
          severity: "INFO",
          message: "Created new employee AH-2026 (Ahmed Hassan) matching SAP personal record successfully.",
          entityName: "Employee",
          entityId: "AH-2026"
        });

        // Record 3: Fatima Al-Thani (NEW) - created under HR
        const hrEmp: Employee = {
          id: "FT-3033",
          name: "Fatima Al-Thani",
          department: "Human Resources",
          departmentId: "DEPT-006",
          role: "SUPERVISOR",
          status: "Offline",
          email: "fatima.t@alhattab.qa",
          phone: "+974 6666 8888",
          shiftId: "GEN-001",
          passwordHash: defaultHash,
          isActive: true
        };
        if (isDbConnected()) {
          const exists = await prismaClient.employee.findUnique({ where: { id: "FT-3033" } });
          if (!exists) {
            await prismaClient.employee.create({ data: hrEmp });
          }
        } else {
          const db = readDb();
          if (!db.employees.some(e => e.id === "FT-3033")) {
            db.employees.push(hrEmp);
            writeDb(db);
          }
        }
        await mockDb.createSapSyncLog({
          jobId: job.id,
          severity: "INFO",
          message: "Created supervisor FT-3033 (Fatima Al-Thani) and linked to Department HR successfully.",
          entityName: "Employee",
          entityId: "FT-3033"
        });

        // Record 4: Alex Martinez (existing) - Terminated! Set isActive=false locally
        if (isDbConnected()) {
          await prismaClient.employee.update({
            where: { id: "AM-8821" },
            data: { isActive: false, status: "Offline" }
          });
        } else {
          const db = readDb();
          const idx = db.employees.findIndex(e => e.id === "AM-8821");
          if (idx !== -1) {
            db.employees[idx].isActive = false;
            db.employees[idx].status = "Offline";
            writeDb(db);
          }
        }
        await mockDb.createSapSyncLog({
          jobId: job.id,
          severity: "WARN",
          message: "Employee AM-8821 (Alex Martinez) marked as TERMINATED in SAP payload. Local account deactivated (isActive=false).",
          entityName: "Employee",
          entityId: "AM-8821"
        });

        // Record 5: Invalid Record (missing email) - fails validation and goes to Retry Queue / DLQ
        await mockDb.createSapSyncLog({
          jobId: job.id,
          severity: "ERROR",
          message: "Validation Error: Employee ERR-09 (Invalid Operative) has no valid email address. Blocked sync.",
          entityName: "Employee",
          entityId: "ERR-09"
        });

        await mockDb.createSapRetryQueueItem({
          module: "EMPLOYEE",
          entityId: "ERR-09",
          payload: JSON.stringify({ id: "ERR-09", name: "Invalid Operative", department: "Logistics", phone: "+974 1234 5678" }),
          retryCount: 0,
          nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // next attempt in 1 hour
          lastError: "Validation Error: Email address must satisfy validation rule EMAIL.",
          status: "PENDING"
        });

        // Complete job metrics
        await mockDb.updateSapSyncJob(job.id, {
          status: "COMPLETED",
          recordsProcessed: 5,
          recordsSucceeded: 4,
          recordsFailed: 1,
          completedAt: new Date().toISOString()
        });
      } else {
        // Log skip message for other modules (since outbound sync is not requested yet)
        await mockDb.createSapSyncLog({
          jobId: job.id,
          severity: "WARN",
          message: `Module ${module} is currently outbound and skipped in Phase 5A foundation.`
        });
        await mockDb.updateSapSyncJob(job.id, {
          status: "COMPLETED",
          recordsProcessed: 0,
          recordsSucceeded: 0,
          recordsFailed: 0,
          completedAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      await mockDb.updateSapSyncJob(job.id, {
        status: "FAILED",
        errorMessage: err.message || "Unknown synchronization error",
        completedAt: new Date().toISOString()
      });
    }

    const updatedJob = await mockDb.getSapSyncJobs();
    return updatedJob.find(j => j.id === job.id) || job;
  },

  triggerSapRetry: async (): Promise<boolean> => {
    // 1. Fetch pending retry items
    const items = await mockDb.getSapRetryQueue();
    const pendingItems = items.filter(i => i.status === "PENDING");

    for (const item of pendingItems) {
      // Mock retry logic: Simulate that admin corrected mapping or added missing email
      // We resolve the item in the queue:
      await mockDb.updateSapRetryQueueItem(item.id, {
        status: "RESOLVED",
        retryCount: item.retryCount + 1,
        lastError: null
      });

      // Log success resolution
      await mockDb.createSapSyncLog({
        jobId: `RETRY-${item.id}`,
        severity: "INFO",
        message: `[Retry Success] Re-processed retry item ${item.entityId} successfully after credentials/validations correction.`,
        entityName: item.module,
        entityId: item.entityId
      });
    }

    return true;
  }
};

