export interface Department {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  department: string; // compatibility string
  departmentId?: string;
  role: string;
  status: "On Duty" | "On Break" | "Offline" | "On Leave" | string;
  avatarUrl?: string;
  email: string;
  phone?: string;
  shiftId?: string;
  passwordHash?: string;
  isActive?: boolean;
}

export interface Worksite {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceCorrection {
  id: string;
  attendanceRecordId: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  status: "Pending" | "Approved" | "Rejected" | string;
  reviewedById?: string;
  reviewNotes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  checkIn: string; // ISO timestamp (effective)
  checkOut?: string; // ISO timestamp (effective)
  originalCheckIn: string; // original check-in timestamp
  originalCheckOut?: string; // original check-out timestamp
  lat: number;
  lng: number;
  device: string;
  status: "ON_TIME" | "LATE" | "OUT_OF_ZONE" | "ABSENT" | "PENDING_CORRECTION" | "CORRECTED" | string;
  locationName: string;
  worksiteId?: string;
  shiftId?: string;
  shiftStartSnapshot?: string;
  shiftEndSnapshot?: string;
  lateMinutes: number;
  standardOtMinutes?: number;
  weekendOtMinutes?: number;
  holidayOtMinutes?: number;
  nightOtMinutes?: number;
  specialEventOtMinutes?: number;
  otApprovedMinutes?: number;
  overtimePayAmount?: number;
  otStatus?: "PENDING" | "APPROVED" | "REJECTED" | string;
}

export interface Shift {
  id: string;
  name: string;
  code: string;
  timeRange: string; // e.g. "09:00 AM — 06:00 PM"
  breakDuration: string; // e.g. "60 mins"
  status: "Active" | "Inactive";
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string; // e.g. "Annual Leave", "Sick Leave"
  dateRange: string; // e.g. "25 Oct - 27 Oct 2023"
  reason: string;
  status: "Approved" | "Rejected" | "Pending Approval" | string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  leaveTypeId?: string;
  currentStep?: number;
  totalSteps?: number;
  workflowId?: string;
  submittedAt?: string;
  firstActionAt?: string;
  approvedAt?: string;
  approvalDurationHours?: number;
  escalationCount?: number;
}

export interface LeaveApprovalWorkflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  conditionExpr?: string; // JSON configuration string
  steps?: LeaveApprovalStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveApprovalStep {
  id: string;
  workflowId: string;
  stepNumber: number;
  roleRequired: string; // "SUPERVISOR" | "MANAGER" | "HR"
  autoApprove: boolean;
  departmentFilter?: string;
  gradeFilter?: string;
  employeeGroupFilter?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveApprovalHistory {
  id: string;
  leaveRequestId: string;
  approverId?: string;
  action: "SUBMIT" | "APPROVE" | "REJECT" | "ESCALATE" | "REMIND" | "AUTO_APPROVE" | string;
  remarks?: string;
  previousStatus: string;
  newStatus: string;
  createdAt?: string;
}

export interface LeaveApprovalDelegation {
  id: string;
  employeeId: string; // original approver
  delegateApproverId: string; // delegate approver
  validFrom: string; // ISO date string
  validTo: string; // ISO date string
  reason: string;
  createdAt?: string;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  accruable: boolean;
  carryForward: boolean;
  maxCarryOver: number;
  expiryMonths: number;
  colorCode: string;
  sapExternalId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType?: LeaveType;
  allocatedDays: number;
  usedDays: number;
  pendingDays: number;
  carriedOver: number;
  sapExternalId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveBalanceLedger {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveType?: LeaveType;
  actionType: "INITIAL" | "ACCRUAL" | "LEAVE_TAKEN" | "CARRY_FORWARD" | "EXPIRY" | "MANUAL_ADJUSTMENT" | string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string;
  remarks?: string;
  createdAt?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string; // ISO date string (YYYY-MM-DD)
  isRecurring: boolean;
  scope: "NATIONAL" | "COMPANY" | "SITE" | string;
  siteId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transformationRule: string;
  status: "Mapped" | "Conflict" | "Unmapped";
}

export interface SyncLog {
  id: string;
  timestamp: string;
  operation: string; // e.g. "Data Pull", "Data Push", "Schema Update"
  subject: string; // e.g. "Payroll_Info_v2"
  status: "Success" | "Failed" | "Warning";
  details: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  author: string;
  category: "General" | "Urgent" | "System Update";
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isSplit: boolean;
  splitStart?: string;
  splitEnd?: string;
  isFlexible: boolean;
  coreHours?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RotationTemplate {
  id: string;
  name: string;
  cycleDays: number;
  patternJson: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeName?: string;
  shiftTemplateId: string;
  shiftTemplate?: ShiftTemplate;
  date: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftSwapRequest {
  id: string;
  requestorId: string;
  requestorName?: string;
  targetEmployeeId: string;
  targetEmployeeName?: string;
  requestorShiftId: string; // shift template id
  requestorShiftName?: string;
  targetShiftId: string; // shift template id
  targetShiftName?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  reason?: string;
  reviewNotes?: string;
  approvedById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OvertimeRate {
  id: string;
  name: string;
  overtimeType: "STANDARD_OT" | "WEEKEND_OT" | "HOLIDAY_OT" | "NIGHT_OT" | "SPECIAL_EVENT_OT" | string;
  multiplier: number;
  fixedRateAmount?: number;
  currency: string;
  appliesOnWeekend: boolean;
  appliesOnHoliday: boolean;
  appliesAfterMinutes: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapConnection {
  id: string;
  systemName: string;
  odataUrl: string;
  clientId: string;
  companyId: string;
  userId: string;
  privateKeyVaultId: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapSyncJob {
  id: string;
  connectionId: string;
  connection?: SapConnection;
  module: "EMPLOYEE" | "LEAVE" | "ATTENDANCE" | "OVERTIME" | "ROSTER" | string;
  syncType: "FULL" | "INCREMENTAL" | "MANUAL" | string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | string;
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  deltaToken?: string;
}

export interface SapSyncLog {
  id: string;
  jobId: string;
  severity: "INFO" | "WARN" | "ERROR" | string;
  entityName?: string;
  entityId?: string;
  message: string;
  createdAt?: string;
}

export interface SapFieldMapping {
  id: string;
  module: "EMPLOYEE" | "LEAVE" | "ATTENDANCE" | string;
  sourceField: string;
  targetField: string;
  transformRule?: string;
  validationRules?: string;
  isRequired: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SapRetryQueue {
  id: string;
  module: "EMPLOYEE" | "LEAVE" | "ATTENDANCE" | string;
  entityId: string;
  payload: string;
  retryCount: number;
  nextAttemptAt: string;
  lastError?: string;
  status: "PENDING" | "FAILED_DLQ" | "RESOLVED" | string;
  createdAt?: string;
  updatedAt?: string;
}


