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
